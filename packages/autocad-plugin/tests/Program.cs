using System.Text.Json;
using Archon.AutoCAD;
var sample=File.ReadAllText(args[0]);
using(var doc=JsonDocument.Parse(sample)) InputContract.Validate(doc.RootElement);
var rejected=0;
foreach(var value in new[]{sample.Replace("\"units\":\"mm\"","\"units\":\"m\""),sample.Replace("\"measuredMm\":10000","\"measuredMm\":9999"),
  sample.Replace("\"layer\":\"ARCHON_WALLS\"","\"layer\":\"EVIL\""),sample.Replace("\"revision\":1","\"revision\":0"),
  sample.Replace("\"executionEnabled\":false","\"executionEnabled\":true"),sample.Replace("\"kind\":\"TEXT\"","\"kind\":\"SCRIPT\"")}) {
  if(value==sample) throw new System.Exception("Test mutation did not change fixture");
  try {using var doc=JsonDocument.Parse(value); InputContract.Validate(doc.RootElement);}
  catch(System.Exception) {rejected++; continue;}
  throw new System.Exception("Malformed payload accepted");
}
Console.WriteLine($"ARCHON plugin contract: valid fixture accepted, {rejected} malformed fixtures rejected");
