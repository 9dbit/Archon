using System.Security.Cryptography;
using System.Text.Json;
using Autodesk.Revit.ApplicationServices;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using DesignAutomationFramework;

namespace Archon.Revit.Generator;

/// <summary>
/// Strictly scoped, native Revit 2026 pilot. No external network requests.
/// Creates a new metric Revit project within the Autodesk Automation sandbox.
/// No seed RVT, Revit desktop install, or customer model is required.
/// </summary>
[Transaction(TransactionMode.Manual)]
[Regeneration(RegenerationOption.Manual)]
public sealed class GeneratorHandler : IExternalDBApplication
{
    private const string InputFile = "archon-pilot-input.json";
    private const string OutputFile = "pilot.rvt";
    private const string ReportFile = "pilot-report.json";

    public ExternalDBApplicationResult OnStartup(ControlledApplication application)
    {
        DesignAutomationBridge.DesignAutomationReadyEvent += OnReady;
        return ExternalDBApplicationResult.Succeeded;
    }

    public ExternalDBApplicationResult OnShutdown(ControlledApplication application)
    {
        DesignAutomationBridge.DesignAutomationReadyEvent -= OnReady;
        return ExternalDBApplicationResult.Succeeded;
    }

    private static void OnReady(object? sender, DesignAutomationReadyEventArgs e)
    {
        e.Succeeded = false;
        var savedOutput = false;
        var savedReport = false;
        var outputPath = Path.GetFullPath(OutputFile);
        var reportPath = Path.GetFullPath(ReportFile);

        try
        {
            var spec = PilotSpec.ReadAndValidate(Path.GetFullPath(InputFile));
            if (File.Exists(outputPath) || File.Exists(reportPath))
                throw new InvalidDataException("ARCHON_OUTPUT_ALREADY_EXISTS");

            var app = e.DesignAutomationData?.RevitApp;
            if (app is null || app.VersionNumber != "2026")
                throw new InvalidDataException("ARCHON_REVIT_ENGINE_NOT_2026");
            // Autodesk supports opening Revit Automation without /i and creating a
            // document via RevitApp.NewProjectDocument(UnitSystem.Metric).
            // Never load or modify a customer-provided RVT in the generator.
            var doc = app.NewProjectDocument(UnitSystem.Metric);
            if (doc is null || doc.IsFamilyDocument || doc.IsReadOnly || doc.IsWorkshared)
                throw new InvalidDataException("ARCHON_FRESH_PROJECT_INVALID");

            var existingWalls = new FilteredElementCollector(doc)
                .OfClass(typeof(Wall)).WhereElementIsNotElementType().ToElementIds();
            if (existingWalls.Count != 0)
                throw new InvalidDataException("ARCHON_NEW_PROJECT_CONTAINS_WALLS");

            var preexistingLevels = new FilteredElementCollector(doc)
                .OfClass(typeof(Level)).WhereElementIsNotElementType()
                .Cast<Level>().OrderBy(x => x.Elevation).ToList();
            if (preexistingLevels.Count > 2)
                throw new InvalidDataException("ARCHON_NEW_PROJECT_HAS_TOO_MANY_LEVELS");

            var wallType = new FilteredElementCollector(doc)
                .OfClass(typeof(WallType)).Cast<WallType>()
                .FirstOrDefault(x => x.Kind == WallKind.Basic);
            // A fresh no-template document may expose its default wall type only
            // when creating the first wall. Wall.Create's default overload is
            // a safe fallback; both paths set exactly 3500 mm wall height.

            var height = UnitUtils.ConvertToInternalUnits(spec.WallHeightMm, UnitTypeId.Millimeters);
            var width = UnitUtils.ConvertToInternalUnits(spec.WidthMm, UnitTypeId.Millimeters);
            var length = UnitUtils.ConvertToInternalUnits(spec.LengthMm, UnitTypeId.Millimeters);
            var upperElevation = UnitUtils.ConvertToInternalUnits(spec.UpperLevelMm, UnitTypeId.Millimeters);
            const double toleranceInFeet = 0.0001;

            // Only the newly created document is normalized. No user model is
            // passed to /i; any default levels may be moved to 0 and 3500 mm.

            Level ground;
            Level upper;
            var created = new List<Wall>();

            using (var transaction = new Transaction(doc, "ARCHON native pilot: four walls"))
            {
                if (transaction.Start() != TransactionStatus.Started)
                    throw new InvalidOperationException("ARCHON_TRANSACTION_START_FAILED");

                ground = preexistingLevels.Count >= 1
                    ? preexistingLevels[0] : Level.Create(doc, 0.0);
                upper = preexistingLevels.Count == 2
                    ? preexistingLevels[1] : Level.Create(doc, upperElevation);
                if (preexistingLevels.Count == 0) ground.Name = "ARCHON Level 0";
                if (preexistingLevels.Count < 2) upper.Name = "ARCHON Level +3500";
                ground.Elevation = 0.0;
                upper.Elevation = upperElevation;

                var corners = new[]
                {
                    new XYZ(0, 0, 0),
                    new XYZ(width, 0, 0),
                    new XYZ(width, length, 0),
                    new XYZ(0, length, 0)
                };
                for (var i = 0; i < corners.Length; i++)
                {
                    var curve = Line.CreateBound(corners[i], corners[(i + 1) % corners.Length]);
                    Wall wall;
                    if (wallType is not null)
                    {
                        wall = Wall.Create(doc, curve, wallType.Id, ground.Id, height, 0.0, false, false);
                    }
                    else
                    {
                        wall = Wall.Create(doc, curve, ground.Id, false);
                        var heightParam = wall.get_Parameter(BuiltInParameter.WALL_USER_HEIGHT_PARAM);
                        if (heightParam is null || heightParam.IsReadOnly || !heightParam.Set(height))
                            throw new InvalidDataException("ARCHON_DEFAULT_WALL_HEIGHT_NOT_SETTABLE");
                    }
                    created.Add(wall);
                }

                if (created.Count != 4 || transaction.Commit() != TransactionStatus.Committed)
                    throw new InvalidOperationException("ARCHON_TRANSACTION_COMMIT_FAILED");
            }

            var actualWalls = new FilteredElementCollector(doc)
                .OfClass(typeof(Wall)).WhereElementIsNotElementType().ToElementIds().Count;
            var actualLevels = new FilteredElementCollector(doc)
                .OfClass(typeof(Level)).WhereElementIsNotElementType()
                .Cast<Level>().OrderBy(x => x.Elevation).ToList();
            if (actualWalls != 4 || actualLevels.Count != 2 ||
                Math.Abs(actualLevels[0].Elevation) > toleranceInFeet ||
                Math.Abs(actualLevels[1].Elevation - upperElevation) > toleranceInFeet)
                throw new InvalidDataException("ARCHON_POST_CREATE_MODEL_INVALID");

            using var saveOptions = new SaveAsOptions
            {
                OverwriteExistingFile = false,
                Compact = true,
                MaximumBackups = 1
            };
            doc.SaveAs(outputPath, saveOptions);
            savedOutput = File.Exists(outputPath) && new FileInfo(outputPath).Length > 0;
            if (!savedOutput)
                throw new IOException("ARCHON_RVT_SAVE_MISSING");

            // Hash the native output in the sandbox, never expose signed URLs or credentials.
            var digest = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(outputPath))).ToLowerInvariant();
            var report = new
            {
                schemaVersion = 1,
                pilot = "GENERATE_FOUR_WALLS",
                sourceMode = "NEW_METRIC_PROJECT_NO_RVT_SEED",
                revitVersion = doc.Application.VersionNumber,
                widthMm = spec.WidthMm,
                lengthMm = spec.LengthMm,
                wallHeightMm = spec.WallHeightMm,
                upperLevelMm = spec.UpperLevelMm,
                wallCount = actualWalls,
                levelCount = actualLevels.Count,
                levelElevationsMm = actualLevels.Select(x =>
                    Math.Round(UnitUtils.ConvertFromInternalUnits(x.Elevation, UnitTypeId.Millimeters), 4)).ToArray(),
                wallElementIds = created.Select(x => x.Id.ToString()).ToArray(),
                outputFilename = OutputFile,
                outputSha256 = digest,
                independentlyReopened = false,
                approvedForProduction = false
            };
            File.WriteAllText(reportPath, JsonSerializer.Serialize(report));
            savedReport = true;
            e.Succeeded = true;
            Console.WriteLine("ARCHON_REVIT_NATIVE_PILOT_GENERATED");
        }
        catch
        {
            if (savedReport && File.Exists(reportPath)) File.Delete(reportPath);
            if (savedOutput && File.Exists(outputPath)) File.Delete(outputPath);
            Console.Error.WriteLine("ARCHON_REVIT_NATIVE_PILOT_FAILED");
            e.Succeeded = false;
        }
    }
}

internal readonly record struct PilotSpec(
    double WidthMm, double LengthMm, double WallHeightMm, double UpperLevelMm)
{
    internal static PilotSpec ReadAndValidate(string path)
    {
        if (!File.Exists(path) || new FileInfo(path).Length is < 1 or > 4096)
            throw new InvalidDataException("ARCHON_INPUT_JSON_MISSING_OR_TOO_LARGE");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
            throw new InvalidDataException("ARCHON_INPUT_JSON_NOT_OBJECT");
        var permitted = new HashSet<string>(StringComparer.Ordinal)
        {
            "schemaVersion", "widthMm", "lengthMm", "wallHeightMm", "upperLevelMm"
        };
        foreach (var p in root.EnumerateObject())
        {
            if (!permitted.Contains(p.Name))
                throw new InvalidDataException("ARCHON_INPUT_FIELD_NOT_ALLOWED");
        }
        if (root.GetProperty("schemaVersion").GetInt32() != 1)
            throw new InvalidDataException("ARCHON_INPUT_SCHEMA_UNSUPPORTED");

        static double RequireExact(JsonElement root, string key, double expected)
        {
            var value = root.GetProperty(key).GetDouble();
            if (!double.IsFinite(value) || Math.Abs(value - expected) > 0.0001)
                throw new InvalidDataException("ARCHON_INPUT_DIMENSION_INVALID");
            return value;
        }
        return new PilotSpec(
            RequireExact(root, "widthMm", 12000.0),
            RequireExact(root, "lengthMm", 20000.0),
            RequireExact(root, "wallHeightMm", 3500.0),
            RequireExact(root, "upperLevelMm", 3500.0));
    }
}
