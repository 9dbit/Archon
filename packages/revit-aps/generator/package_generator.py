#!/usr/bin/env python3
"""Deterministic offline generator AppBundle packaging. No Autodesk requests."""
import hashlib
import pathlib
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

ROOT = pathlib.Path(__file__).resolve().parent
BUNDLE = "ArchonRevitGeneratePilot.bundle"
PLUGIN = "Archon.Revit.Generator.dll"
ADDIN = "Archon.Revit.Generator.addin"
BRIDGE = "DesignAutomationBridge.dll"


def package(dll_path: pathlib.Path):
    if not dll_path.is_file() or dll_path.name != PLUGIN or dll_path.stat().st_size == 0:
        raise ValueError("REVIT_GENERATOR_DLL_INVALID")
    bridge_path = dll_path.parent / BRIDGE
    if not bridge_path.is_file() or bridge_path.stat().st_size == 0:
        raise ValueError("REVIT_GENERATOR_BRIDGE_MISSING")

    root = ET.parse(ROOT / "PackageContents.xml").getroot()
    if root.attrib.get("Name") != "ArchonRevitGeneratePilot":
        raise ValueError("REVIT_GENERATOR_BUNDLE_NAME_INVALID")
    entry = root.find("./Components/ComponentEntry")
    expected = "./Contents/" + ADDIN
    if entry is None or entry.attrib.get("ModuleName") != expected:
        raise ValueError("REVIT_GENERATOR_MANIFEST_INVALID")
    addin = ET.parse(ROOT / ADDIN).getroot()
    if addin.findtext("./AddIn/Assembly") != ".\\" + PLUGIN:
        raise ValueError("REVIT_GENERATOR_ADDIN_DLL_INVALID")
    if addin.findtext("./AddIn/FullClassName") != "Archon.Revit.Generator.GeneratorHandler":
        raise ValueError("REVIT_GENERATOR_ADDIN_CLASS_INVALID")

    target = ROOT.parent / "artifacts"
    target.mkdir(parents=True, exist_ok=True)
    zip_path = target / "ArchonRevitGeneratePilot.zip"
    contents = (
        ("PackageContents.xml", ROOT / "PackageContents.xml"),
        ("Contents/" + ADDIN, ROOT / ADDIN),
        ("Contents/" + PLUGIN, dll_path),
        ("Contents/" + BRIDGE, bridge_path),
    )
    with ZipFile(zip_path, "w") as archive:
        for name, path in contents:
            item = ZipInfo(BUNDLE + "/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            item.compress_type = ZIP_DEFLATED
            item.external_attr = 0o644 << 16
            archive.writestr(item, path.read_bytes())

    with ZipFile(zip_path) as archive:
        if sorted(archive.namelist()) != sorted(BUNDLE + "/" + path for path, _ in contents):
            raise ValueError("REVIT_GENERATOR_ZIP_INVALID")
        if archive.testzip() is not None:
            raise ValueError("REVIT_GENERATOR_ZIP_CORRUPT")

    digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (target / "ArchonRevitGeneratePilot.zip.sha256").write_text(digest + "\n", encoding="utf-8")
    print("REVIT_GENERATOR_BUNDLE_VERIFIED " + digest)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: package_generator.py <path/to/Archon.Revit.Generator.dll>")
    package(pathlib.Path(sys.argv[1]))
