using System.Text.Json;
namespace Archon.AutoCAD;
public static class InputContract {
  public static string Text(JsonElement obj, string key) {
    var value = obj.GetProperty(key).GetString();
    if (string.IsNullOrWhiteSpace(value) || value.Length > 256 || value.Any(char.IsControl)) throw new InvalidDataException("ARCHON_TEXT_INVALID");
    return value;
  }
  public static double[] Point(JsonElement obj, string key) {
    var values = obj.GetProperty(key).EnumerateArray().Select(v => v.GetDouble()).ToArray();
    if (values.Length != 2 || values.Any(v => !double.IsFinite(v) || Math.Abs(v) > 1e9)) throw new InvalidDataException("ARCHON_POINT_INVALID");
    return values;
  }
  public static void Validate(JsonElement root) {
    if (root.GetProperty("schemaVersion").GetInt32() != 1 || Text(root,"units") != "mm" ||
        Text(root,"coordinateMapping") != "ARCHON_XZ_TO_CAD_XY" ||
        root.GetProperty("executionEnabled").GetBoolean() ||
        Text(root,"reconciliation") != "PROPOSE_CHANGESET_ONLY") throw new InvalidDataException("ARCHON_CONTRACT_INVALID");
    var source = root.GetProperty("source");
    Text(source,"projectId"); Text(source,"versionId"); Text(source,"level");
    var mode = Text(source,"mode");
    if (mode != "PREVIEW" && mode != "APPROVED_VERSION") throw new InvalidDataException("ARCHON_SOURCE_INVALID");
    if (mode == "PREVIEW") Text(source,"changeSetId");
    var entities = root.GetProperty("entities");
    if (entities.GetArrayLength() < 1 || entities.GetArrayLength() > 10000) throw new InvalidDataException("ARCHON_ENTITY_LIMIT");
    foreach (var entity in entities.EnumerateArray()) {
      Text(entity,"sourceId");
      if (entity.GetProperty("revision").GetInt32() < 1) throw new InvalidDataException("ARCHON_REVISION_INVALID");
      var kind = Text(entity,"kind"); var layer = Text(entity,"layer");
      if (kind == "POLYLINE") {
        if (layer != "ARCHON_SITE" && layer != "ARCHON_WALLS") throw new InvalidDataException("ARCHON_LAYER_INVALID");
        if (!entity.GetProperty("closed").GetBoolean()) throw new InvalidDataException("ARCHON_POLYLINE_INVALID");
        var points = entity.GetProperty("pointsMm").EnumerateArray().Select(p => {
          var values = p.EnumerateArray().Select(v=>v.GetDouble()).ToArray();
          if (values.Length != 2 || values.Any(v=>!double.IsFinite(v)||Math.Abs(v)>1e9)) throw new InvalidDataException("ARCHON_POINT_INVALID");
          return values;
        }).ToArray();
        if (points.Length != 4 || points[0][0] >= points[1][0] || points[0][1] >= points[3][1] ||
          points[0][1] != points[1][1] || points[1][0] != points[2][0] ||
          points[2][1] != points[3][1] || points[3][0] != points[0][0]) throw new InvalidDataException("ARCHON_RECTANGLE_INVALID");
      } else if (kind == "TEXT") {
        if (layer != "ARCHON_ROOMS") throw new InvalidDataException("ARCHON_LAYER_INVALID");
        Point(entity,"positionMm"); Text(entity,"text");
      } else if (kind == "DIMENSION") {
        if (layer != "ARCHON_DIMS") throw new InvalidDataException("ARCHON_LAYER_INVALID");
        var a=Point(entity,"startMm"); var b=Point(entity,"endMm"); var axis=Text(entity,"axis");
        var measured=entity.GetProperty("measuredMm").GetDouble();
        if ((axis != "X" && axis != "Z") || (axis=="X" && a[1]!=b[1]) || (axis=="Z" && a[0]!=b[0]) ||
          !double.IsFinite(measured) || measured<=0 ||
          Math.Abs(Math.Sqrt(Math.Pow(b[0]-a[0],2)+Math.Pow(b[1]-a[1],2))-measured)>1e-6) throw new InvalidDataException("ARCHON_DIMENSION_INVALID");
      } else throw new InvalidDataException("ARCHON_ENTITY_UNSUPPORTED");
    }
  }
}
