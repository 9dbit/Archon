using Autodesk.Revit.DB;

namespace Archon.Revit.Pilot;

/// <summary>
/// Measurement-only independent geometry inspection for an already-open RVT.
/// No Revit Transaction, Save, or other modifying API is used here.
/// </summary>
internal static class PilotGeometryInspector
{
    private const double ToleranceMm = 1.0;

    private static double Mm(double internalFeet) =>
        UnitUtils.ConvertFromInternalUnits(internalFeet, UnitTypeId.Millimeters);

    private static bool Near(double actual, double target) =>
        double.IsFinite(actual) && Math.Abs(actual - target) <= ToleranceMm;

    private readonly record struct Edge(
        double X0, double Y0, double Z0, double X1, double Y1, double Z1);

    private static bool EdgeMatches(Edge a, Edge b)
    {
        static bool EndsMatch(
            double ax, double ay, double az, double bx, double by, double bz) =>
            Near(ax, bx) && Near(ay, by) && Near(az, bz);

        return (
            EndsMatch(a.X0, a.Y0, a.Z0, b.X0, b.Y0, b.Z0) &&
            EndsMatch(a.X1, a.Y1, a.Z1, b.X1, b.Y1, b.Z1)
        ) || (
            EndsMatch(a.X0, a.Y0, a.Z0, b.X1, b.Y1, b.Z1) &&
            EndsMatch(a.X1, a.Y1, a.Z1, b.X0, b.Y0, b.Z0)
        );
    }

    internal static object Inspect(Document doc, int wallCount, int levelCount)
    {
        if (wallCount != 4 || levelCount != 2)
        {
            return new
            {
                assessed = false,
                matchesNativePilot = false,
                reason = "EXPECTED_FOUR_WALLS_TWO_LEVELS"
            };
        }

        var walls = new FilteredElementCollector(doc)
            .OfClass(typeof(Wall)).WhereElementIsNotElementType()
            .Cast<Wall>().ToList();
        var levels = new FilteredElementCollector(doc)
            .OfClass(typeof(Level)).WhereElementIsNotElementType()
            .Cast<Level>().OrderBy(x => x.Elevation).ToList();

        if (walls.Count != 4 || levels.Count != 2)
        {
            return new
            {
                assessed = false,
                matchesNativePilot = false,
                reason = "COLLECTOR_COUNT_MISMATCH"
            };
        }

        var expected = new[]
        {
            new Edge(0, 0, 0, 12000, 0, 0),
            new Edge(12000, 0, 0, 12000, 20000, 0),
            new Edge(12000, 20000, 0, 0, 20000, 0),
            new Edge(0, 20000, 0, 0, 0, 0)
        };
        var used = new bool[expected.Length];
        var wallHeights = new List<double>();
        var wallLengths = new List<double>();
        var segmentMatching = true;

        foreach (var wall in walls)
        {
            if (wall.Location is not LocationCurve location ||
                location.Curve is not Line curve)
            {
                segmentMatching = false;
                continue;
            }

            var p0 = curve.GetEndPoint(0);
            var p1 = curve.GetEndPoint(1);
            var actual = new Edge(
                Mm(p0.X), Mm(p0.Y), Mm(p0.Z),
                Mm(p1.X), Mm(p1.Y), Mm(p1.Z));

            var found = false;
            for (var i = 0; i < expected.Length; i++)
            {
                if (!used[i] && EdgeMatches(actual, expected[i]))
                {
                    used[i] = true;
                    found = true;
                    break;
                }
            }
            if (!found) segmentMatching = false;

            wallLengths.Add(Mm(curve.Length));
            var height = wall.get_Parameter(BuiltInParameter.WALL_USER_HEIGHT_PARAM);
            wallHeights.Add(height?.StorageType == StorageType.Double
                ? Mm(height.AsDouble()) : double.NaN);
        }

        var elevations = levels.Select(x => Mm(x.Elevation)).ToArray();
        var heightsValid = wallHeights.Count == 4 &&
                           wallHeights.All(height => Near(height, 3500));
        var levelsValid = Near(elevations[0], 0) && Near(elevations[1], 3500);
        var lengths = wallLengths.OrderBy(x => x).ToArray();
        var lengthsValid = lengths.Length == 4 &&
                           Near(lengths[0], 12000) && Near(lengths[1], 12000) &&
                           Near(lengths[2], 20000) && Near(lengths[3], 20000);
        var passed = segmentMatching && used.All(v => v) && lengthsValid &&
                     heightsValid && levelsValid;

        return new
        {
            assessed = true,
            matchesNativePilot = passed,
            toleranceMm = ToleranceMm,
            measuredWallLengthsMm = wallLengths.Select(x => Math.Round(x, 3)).ToArray(),
            measuredWallHeightsMm = wallHeights.Select(x =>
                double.IsFinite(x) ? Math.Round(x, 3) : (double?)null).ToArray(),
            measuredLevelElevationsMm = elevations.Select(x => Math.Round(x, 3)).ToArray(),
            fourExpectedSegments = segmentMatching && used.All(v => v),
            twoExpectedLevels = levelsValid,
            fourExpectedWallHeights = heightsValid,
            wallLengthsMatch = lengthsValid
        };
    }
}
