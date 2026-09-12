using System.Security.Cryptography;
using System.Text.Json;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using Autodesk.AutoCAD.Runtime;
namespace Archon.AutoCAD;
public class Commands {
  [CommandMethod("ARCHON", "ARCHONLAYOUT", CommandFlags.Modal)]
  public void GenerateLayout() {
    // Fixed sandbox-local paths. Never modifies the open seed drawing or ARCHON state.
    const string inputPath="archon-input.json", outputPath="archon-output.dwg", reportPath="archon-report.json";
    if (File.Exists(outputPath) || File.Exists(reportPath)) throw new InvalidDataException("ARCHON_OUTPUT_EXISTS");
    if (new FileInfo(inputPath).Length>16*1024*1024) throw new InvalidDataException("ARCHON_INPUT_LIMIT");
    var bytes=File.ReadAllBytes(inputPath);
    using var document=JsonDocument.Parse(bytes);
    var root=document.RootElement; InputContract.Validate(root);
    using var db=new Database(true,true);
    var previous=HostApplicationServices.WorkingDatabase;
    try {
      HostApplicationServices.WorkingDatabase=db;
      db.Insunits=UnitsValue.Millimeters;
      var ids=new List<(ObjectId Id,JsonElement Input,int Index)>();
      using(var transaction=db.TransactionManager.StartTransaction()) {
        var layers=(LayerTable)transaction.GetObject(db.LayerTableId,OpenMode.ForWrite);
        foreach(var name in new[]{"ARCHON_SITE","ARCHON_WALLS","ARCHON_ROOMS","ARCHON_DIMS"}) {
          if(!layers.Has(name)) { var layer=new LayerTableRecord{Name=name}; layers.Add(layer); transaction.AddNewlyCreatedDBObject(layer,true); }
        }
        var apps=(RegAppTable)transaction.GetObject(db.RegAppTableId,OpenMode.ForWrite);
        if(!apps.Has("ARCHON")) {var app=new RegAppTableRecord{Name="ARCHON"}; apps.Add(app); transaction.AddNewlyCreatedDBObject(app,true);}
        var table=(BlockTable)transaction.GetObject(db.BlockTableId,OpenMode.ForRead);
        var model=(BlockTableRecord)transaction.GetObject(table[BlockTableRecord.ModelSpace],OpenMode.ForWrite);
        var index=0;
        foreach(var input in root.GetProperty("entities").EnumerateArray()) {
          Entity entity;
          switch(InputContract.Text(input,"kind")) {
            case "POLYLINE":
              var line=new Polyline(); var vertex=0;
              foreach(var p in input.GetProperty("pointsMm").EnumerateArray()) line.AddVertexAt(vertex++,new Point2d(p[0].GetDouble(),p[1].GetDouble()),0,0,0);
              line.Closed=true; entity=line; break;
            case "TEXT":
              var point=InputContract.Point(input,"positionMm");
              entity=new DBText{Position=new Point3d(point[0],point[1],0),Height=200,TextString=InputContract.Text(input,"text")}; break;
            case "DIMENSION":
              var a=InputContract.Point(input,"startMm"); var b=InputContract.Point(input,"endMm");
              var horizontal=InputContract.Text(input,"axis")=="X";
              var offset=horizontal?new Point3d((a[0]+b[0])/2,a[1]-500,0):new Point3d(a[0]-500,(a[1]+b[1])/2,0);
              entity=new RotatedDimension(horizontal?0:Math.PI/2,new Point3d(a[0],a[1],0),new Point3d(b[0],b[1],0),offset,"",db.Dimstyle); break;
            default: throw new InvalidDataException("ARCHON_ENTITY_UNSUPPORTED");
          }
          entity.SetDatabaseDefaults(db); entity.Layer=InputContract.Text(input,"layer");
          var id=model.AppendEntity(entity); transaction.AddNewlyCreatedDBObject(entity,true);
          entity.XData=new ResultBuffer(new TypedValue(1001,"ARCHON"),new TypedValue(1000,InputContract.Text(input,"sourceId")),
            new TypedValue(1000,input.GetProperty("revision").GetInt32().ToString()),new TypedValue(1000,InputContract.Text(root.GetProperty("source"),"versionId")));
          if(entity is Dimension dimension) dimension.RecomputeDimensionBlock(true);
          ids.Add((id,input,index++));
        }
        transaction.Commit();
      }
      var reports=new List<object>();
      using(var transaction=db.TransactionManager.StartTransaction()) {
        foreach(var item in ids) {
          var entity=(Entity)transaction.GetObject(item.Id,OpenMode.ForRead);
          object geometry;
          if(entity is Polyline line) geometry=new {closed=line.Closed,pointsMm=Enumerable.Range(0,line.NumberOfVertices).Select(i=>new[]{line.GetPoint2dAt(i).X,line.GetPoint2dAt(i).Y}).ToArray()};
          else if(entity is DBText text) geometry=new {positionMm=new[]{text.Position.X,text.Position.Y},text=text.TextString};
          else if(entity is RotatedDimension dimension) {
            if(Math.Abs(dimension.Measurement-item.Input.GetProperty("measuredMm").GetDouble())>1e-6) throw new InvalidDataException("ARCHON_DIMENSION_RECONCILIATION_FAILED");
            geometry=new {startMm=new[]{dimension.XLine1Point.X,dimension.XLine1Point.Y},endMm=new[]{dimension.XLine2Point.X,dimension.XLine2Point.Y},measuredMm=dimension.Measurement};
          } else throw new InvalidDataException("ARCHON_OUTPUT_TYPE_INVALID");
          reports.Add(new {inputIndex=item.Index,sourceId=InputContract.Text(item.Input,"sourceId"),revision=item.Input.GetProperty("revision").GetInt32(),
            kind=InputContract.Text(item.Input,"kind"),handle=entity.Handle.ToString(),layer=entity.Layer,geometry});
        }
        transaction.Commit();
      }
      db.SaveAs(outputPath,DwgVersion.AC1032);
      var report=new {schemaVersion=1,source=root.GetProperty("source").Clone(),units="mm",coordinateMapping="ARCHON_XZ_TO_CAD_XY",
        inputSha256=Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),outputFile=outputPath,entities=reports,
        reconciliation="PROPOSE_CHANGESET_ONLY",governanceAuthority="NONE"};
      File.WriteAllText(reportPath,JsonSerializer.Serialize(report));
    } catch {
      // A failed run must not leave artifacts that can be mistaken for success.
      if(File.Exists(outputPath)) File.Delete(outputPath);
      if(File.Exists(reportPath)) File.Delete(reportPath);
      throw;
    } finally {HostApplicationServices.WorkingDatabase=previous;}
  }
}
