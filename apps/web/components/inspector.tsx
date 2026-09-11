export function Inspector(){
  return <aside className="inspector">
    <div className="inspector-tabs"><button className="active">Properties</button><button>Relationships</button><button>Validation</button><button>History</button></div>
    <section><div className="section-head"><b>Wall</b><button>Edit</button></div><dl><dt>ID</dt><dd>W-014</dd><dt>Type</dt><dd>Interior Partition</dd><dt>Length</dt><dd>6,400 mm</dd><dt>Height</dt><dd>3,200 mm</dd><dt>Thickness</dt><dd>150 mm</dd><dt>Material</dt><dd>AAC + Plaster</dd><dt>Layer</dt><dd>A-WALL</dd><dt>Level</dt><dd>Ground Floor</dd></dl></section>
    <section><b>Connected Elements</b><div className="chips"><span>Kitchen R-01</span><span>Storage R-02</span><span>Door D-03</span><span>Window W-05</span></div></section>
    <section><b>Validation</b><ul className="checks"><li>✓ Geometry dimension OK</li><li>✓ Meets fire rating requirement</li><li>✓ Connected to room boundaries</li><li className="warning">⚠ Acoustic requirement not defined</li></ul></section>
    <section><b>Tags</b><div className="chips"><span>Interior</span><span>Kitchen</span><span>Structural</span></div></section>
  </aside>;
}
