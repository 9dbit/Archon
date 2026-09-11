'use client';

import { XCircle } from 'lucide-react';
import { useState } from 'react';

export type ProposalState = 'PROPOSED' | 'APPROVED' | 'REJECTED';

export function ChangeSetBar(){
  const [state,setState] = useState<ProposalState>('PROPOSED');
  if(state !== 'PROPOSED') return <div className="changeset-bar"><div><span className="status-dot"/><b>{state === 'APPROVED' ? 'CHANGE APPROVED' : 'CHANGE DISCARDED'}</b><small>CS-0142</small><p>{state === 'APPROVED' ? 'Ready to create immutable project version.' : 'Approved baseline remains unchanged.'}</p></div></div>;
  return <div className="changeset-bar">
    <div><span className="status-dot"/><b>PROPOSED CHANGE</b><small>CS-0142</small><p>Lebarkan kitchen menjadi 6,400 mm (+600 mm) · 27 objects affected</p></div>
    <div className="validation-count"><span>8 ✓</span><span>1 ⚠</span></div>
    <button>Preview Changes</button><button>Edit</button><button className="approve" onClick={()=>setState('APPROVED')}>Approve</button><button className="discard" onClick={()=>setState('REJECTED')}><XCircle size={15}/>Discard</button>
  </div>;
}
