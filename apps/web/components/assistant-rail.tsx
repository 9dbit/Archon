'use client';

import { MessageSquare, Search, Send } from 'lucide-react';

const conversations = [
  ['Lebarkan kitchen menjadi 6.4 m','Layout • 2D Plan','10:24'],
  ['Adjust seating 120 pax','Space Planning','09:18'],
  ['Add dimension to all walls','2D Plan • Dimension','08:45'],
  ['Check circulation 1.5 m','Analysis • Compliance','08:12'],
  ['Zoning alternatif','Layout • Zoning','Yesterday'],
  ['Material palette selection','Design • Concept','Yesterday'],
  ['Revit export settings','Integrations • BIM','4 Sep']
];

export function AssistantRail(){
  return <aside className="assistant-panel">
    <div className="assistant-head"><div><strong>AI Assistant</strong><span className="online">● Online</span><small>Your Architecture Partner</small></div><button className="ghost">+ New Chat</button></div>
    <div className="conversation-search"><Search size={15}/><span>Search conversations...</span></div>
    <div className="conversation-scroll"><h4>Today</h4>{conversations.map(([title,meta,time],i)=><button className={i===0?'conversation active':'conversation'} key={title}><MessageSquare size={16}/><span><b>{title}</b><small>{meta}</small></span><time>{time}</time></button>)}</div>
    <div className="suggestions"><small>Suggested commands</small><button>Add dimensions to all rooms</button><button>Optimize layout for 120 pax</button><button>Check circulation width</button><button>Show 3D view of this plan</button></div>
    <div className="composer"><button>+</button><input placeholder="Ask ARCHON anything..."/><button><Send size={17}/></button></div>
    <div className="tip">Tip: Try “Lebarkan kitchen 300 mm ke timur”</div>
  </aside>;
}
