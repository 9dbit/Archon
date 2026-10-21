using System.Text.Json;
using Autodesk.Revit.ApplicationServices;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using DesignAutomationFramework;

namespace Archon.Revit.Pilot;

[Transaction(TransactionMode.Manual)]
[Regeneration(RegenerationOption.Manual)]
public sealed class PilotHandler : IExternalDBApplication
{
    private const string ReportPath = "archon-revit-report.json";

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
        var startedWriting = false;
        try
        {
            if (File.Exists(ReportPath)) throw new InvalidDataException("ARCHON_REPORT_EXISTS");
            var doc = e.DesignAutomationData.RevitDoc;
            if (doc is null || doc.IsFamilyDocument) throw new InvalidDataException("ARCHON_MODEL_INVALID");
            using var walls = new FilteredElementCollector(doc);
            using var levels = new FilteredElementCollector(doc);
            var wallCount = walls.OfClass(typeof(Wall)).WhereElementIsNotElementType().ToElementIds().Count;
            var levelCount = levels.OfClass(typeof(Level)).WhereElementIsNotElementType().ToElementIds().Count;
            var report = new
            {
                schemaVersion = 1,
                pilot = "READ_ONLY_METADATA",
                modelTitle = doc.Title,
                revitVersion = doc.Application.VersionNumber,
                wallCount,
                levelCount,
                geometry = PilotGeometryInspector.Inspect(doc, wallCount, levelCount),
                modelModified = false,
                approvalGranted = false,
                reconciliation = "REPORT_ONLY",
                governanceAuthority = "NONE"
            };
            var serialized = JsonSerializer.Serialize(report);
            startedWriting = true;
            File.WriteAllText(ReportPath, serialized);
            e.Succeeded = true;
            Console.WriteLine("ARCHON_REVIT_PILOT_REPORT_WRITTEN");
        }
        catch
        {
            if (startedWriting && File.Exists(ReportPath)) File.Delete(ReportPath);
            Console.Error.WriteLine("ARCHON_REVIT_PILOT_FAILED");
            e.Succeeded = false;
        }
    }
}
