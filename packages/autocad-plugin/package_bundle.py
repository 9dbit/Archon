from pathlib import Path
import hashlib
import sys
import zipfile
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parent
assembly = Path(sys.argv[1])
if not assembly.is_file() or assembly.stat().st_size == 0:
    raise SystemExit("Missing compiled Archon.AutoCAD.dll")
manifest = root / "PackageContents.xml"
tree = ET.parse(manifest)
entry = tree.find(".//ComponentEntry")
assert entry is not None and entry.attrib["ModuleName"] == "./Contents/Archon.AutoCAD.dll"
assert tree.find(".//Command").attrib["Global"] == "ARCHONLAYOUT"
out = root / "artifacts"
out.mkdir(exist_ok=True)
archive = out / "ArchonLayoutBundle.zip"
expected = {"ArchonLayout.bundle/PackageContents.xml", "ArchonLayout.bundle/Contents/Archon.AutoCAD.dll"}
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(manifest, "ArchonLayout.bundle/PackageContents.xml")
    z.write(assembly, "ArchonLayout.bundle/Contents/Archon.AutoCAD.dll")
with zipfile.ZipFile(archive) as z:
    assert set(z.namelist()) == expected and z.testzip() is None
(out / "ArchonLayoutBundle.zip.sha256").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  ArchonLayoutBundle.zip\n")
print("Compiled bundle packaged and ZIP entries verified")
