import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Code2,
  Command,
  Copy,
  Database,
  FileText,
  Fingerprint,
  FolderKanban,
  GitBranch,
  Globe2,
  Headphones,
  LayoutGrid,
  LockKeyhole,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Network,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

type Agent = {
  id: string;
  name: string;
  role: string;
  dept: string;
  avatar: string;
  accent: string;
  status: "online" | "working" | "idle";
  expertise: string[];
  last: string;
};

type Department = { id: string; name: string; purpose: string; count: number; color: string; trend: string };
type WorkforceMessage = { id: string; from: "user" | "rightHand" | "agent" | "system"; sender: string; body: string; time: string; kind?: "plan" | "normal" | "approval" };

type ToastTone = "success" | "info";
type Toast = { text: string; tone: ToastTone } | null;

const agentsSeed: Agent[] = [
  { id: "right-hand", name: "Ari", role: "AI Right Hand · Chief of Staff", dept: "Executive Office", avatar: "AR", accent: "mint", status: "online", expertise: ["Orchestration", "Planning", "Memory"], last: "Otak utama workforce" },
  { id: "mira", name: "Mira Chen", role: "Head of Growth Intelligence", dept: "Growth & Marketing", avatar: "MC", accent: "violet", status: "working", expertise: ["Research", "Content", "Analytics"], last: "Synthesizing campaign brief" },
  { id: "elio", name: "Elio Park", role: "Product Strategy Lead", dept: "Product & Design", avatar: "EP", accent: "blue", status: "online", expertise: ["Product", "UX", "Roadmaps"], last: "Available for delegation" },
  { id: "noor", name: "Noor Patel", role: "Research Analyst", dept: "Research & Intelligence", avatar: "NP", accent: "amber", status: "working", expertise: ["Web research", "Synthesis", "Citations"], last: "Running market scan" },
  { id: "sora", name: "Sora Kim", role: "Finance Controller", dept: "Finance & Operations", avatar: "SK", accent: "coral", status: "idle", expertise: ["Budgets", "Forecasting", "Controls"], last: "Last active 18 min ago" },
  { id: "jax", name: "Jax Rivera", role: "Automation Engineer", dept: "Engineering & Automation", avatar: "JR", accent: "cyan", status: "online", expertise: ["APIs", "Code", "Workflows"], last: "Ready to build" },
];

const departmentSeed: Department[] = [
  { id: "exec", name: "Executive Office", purpose: "Priorities, decisions, and company-wide orchestration", count: 2, color: "mint", trend: "+4% throughput" },
  { id: "growth", name: "Growth & Marketing", purpose: "Demand generation, messaging, and market signals", count: 6, color: "violet", trend: "+18% output" },
  { id: "product", name: "Product & Design", purpose: "Customer insight, product strategy, and experience", count: 5, color: "blue", trend: "3 active threads" },
  { id: "ops", name: "Finance & Operations", purpose: "Reliable systems, numbers, and operating cadence", count: 4, color: "amber", trend: "2 approvals" },
];

const initialMessages: WorkforceMessage[] = [
  { id: "welcome", from: "rightHand", sender: "Ari · AI Right Hand", body: "Good morning, Naya. I’m watching the whole company for you. Tell me what you want to move forward — I’ll turn it into a plan, bring in the right people, and keep you in the loop.", time: "09:41", kind: "normal" },
  { id: "signal", from: "system", sender: "Workforce signal", body: "3 agents are online · 1 workflow is waiting for approval · memory sync completed 8 min ago", time: "09:42", kind: "normal" },
  { id: "mira", from: "agent", sender: "Mira Chen · Growth", body: "I’ve prepared the first pass of the launch narrative. Ari routed this to me after your Q2 growth note.", time: "09:44", kind: "normal" },
];

const workflowSeed = [
  { name: "Weekly executive pulse", owner: "Ari", status: "Running", progress: 72, next: "Friday · 16:00", icon: Activity, color: "mint" },
  { name: "Inbound lead qualification", owner: "Mira + Noor", status: "Waiting approval", progress: 44, next: "Needs your go-ahead", icon: Target, color: "violet" },
  { name: "Customer insight loop", owner: "Elio", status: "Healthy", progress: 89, next: "Tomorrow · 09:00", icon: RefreshCw, color: "blue" },
];

const memorySeed = [
  { title: "Naya prefers concise decision memos", type: "Preference", agent: "Ari", updated: "2h ago", score: 98 },
  { title: "Q2 launch narrative: calm confidence", type: "Shared knowledge", agent: "Growth", updated: "Today", score: 91 },
  { title: "Only ask for approval before external sends", type: "Permission rule", agent: "Workspace", updated: "Yesterday", score: 100 },
  { title: "Research sources must include citations", type: "Department policy", agent: "Research", updated: "Yesterday", score: 96 },
];

function avatarClass(accent: string) { return `wf-avatar wf-${accent}`; }

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();
  const planMutation = trpc.rightHand.plan.useMutation();
  const [activeNav, setActiveNav] = useState("command");
  const [activeAgentId, setActiveAgentId] = useState("right-hand");
  const [messages, setMessages] = useState(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [localAgents, setLocalAgents] = useState(agentsSeed);
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const agents = localAgents;
  const activeAgent = agents.find((agent) => agent.id === activeAgentId) ?? agents[0];
  const filteredAgents = useMemo(() => agents.filter((agent) => {
    const q = agentSearch.toLowerCase();
    return (!q || `${agent.name} ${agent.role} ${agent.dept}`.toLowerCase().includes(q)) && (selectedDepartment === "all" || agent.dept === selectedDepartment);
  }), [agents, agentSearch, selectedDepartment]);

  const notify = (text: string, tone: ToastTone = "success") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  const localPlanResponse = (request: string) => ({
    summary: `Saya akan mengubah “${request}” menjadi execution loop yang terukur, dengan checkpoint sebelum tindakan berisiko.`,
    department: request.toLowerCase().includes("market") || request.toLowerCase().includes("campaign") ? "Growth & Marketing" : "Executive Office",
    selectedAgents: request.toLowerCase().includes("market") ? ["Mira Chen", "Noor Patel"] : ["Ari", "Elio Park", "Jax Rivera"],
    steps: ["Clarify the outcome and success signal", "Route work to the best-fit agents", "Synthesize findings into a decision memo", "Ask for approval before external action"],
  });

  const sendPrompt = async () => {
    const request = prompt.trim();
    if (!request || planMutation.isPending) return;
    setMessages((current) => [...current, { id: `u-${Date.now()}`, from: "user", sender: user?.name ?? "You", body: request, time: "now", kind: "normal" }]);
    setPrompt("");
    if (isAuthenticated) {
      try {
        const result = await planMutation.mutateAsync({ request });
        setMessages((current) => [...current, { id: `p-${Date.now()}`, from: "rightHand", sender: "Ari · AI Right Hand", body: result.plan.summary, time: "now", kind: "plan" }]);
        notify(`Plan ready · ${result.plan.selectedAgents.length} agents routed`);
      } catch {
        const plan = localPlanResponse(request);
        setMessages((current) => [...current, { id: `p-${Date.now()}`, from: "rightHand", sender: "Ari · AI Right Hand", body: plan.summary, time: "now", kind: "plan" }]);
        notify("Demo plan shown · sign in to run the live orchestrator", "info");
      }
    } else {
      window.setTimeout(() => {
        const plan = localPlanResponse(request);
        setMessages((current) => [...current, { id: `p-${Date.now()}`, from: "rightHand", sender: "Ari · AI Right Hand", body: plan.summary, time: "now", kind: "plan" }]);
        notify("Demo plan ready · sign in to run LangGraph orchestration", "info");
      }, 520);
    }
  };

  const addAgent = () => {
    if (!newAgentName.trim()) return;
    const initials = newAgentName.trim().split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    setLocalAgents((current) => [...current, { id: `new-${Date.now()}`, name: newAgentName.trim(), role: "New workforce specialist", dept: "Executive Office", avatar: initials, accent: "mint", status: "idle", expertise: ["Needs configuration"], last: "Draft agent" }]);
    setNewAgentName("");
    setShowAgentModal(false);
    notify("Agent draft created · configure memory and permissions next");
  };

  return (
    <main className="workforce-shell">
      <div className="wf-glow glow-left" />
      <div className="wf-glow glow-right" />
      <section className="workforce-app">
        <header className="topbar">
          <div className="topbar-brand"><div className="wf-logo"><span /></div><div><strong>whisp</strong><small>AI workforce platform</small></div></div>
          <div className="topbar-context"><span className="context-dot" />NAYA / <b>PERSONAL COMPANY</b><ChevronDown size={13} /></div>
          <div className="topbar-actions"><div className="live-pill"><span /> all systems nominal</div><button className="top-icon" title="Search"><Search size={17} /></button><button className="top-icon" title="Settings" onClick={() => notify("Workspace settings ready for configuration", "info")}><Settings2 size={17} /></button><div className="user-chip" onClick={() => isAuthenticated ? notify(`${user?.name ?? "Account"} is signed in`, "info") : startLogin()}><span>{isAuthenticated ? (user?.name?.[0] ?? "N") : "N"}</span><ChevronDown size={12} /></div></div>
        </header>
        <div className="wf-layout">
          <aside className={`wf-sidebar ${showSidebar ? "" : "collapsed"}`}>
            <button className="collapse-button" onClick={() => setShowSidebar((value) => !value)}><Menu size={16} /></button>
            <div className="sidebar-label">COMMAND CENTER</div>
            <nav className="wf-nav">
              {[{ id: "command", label: "Command Center", icon: Command }, { id: "agents", label: "AI Workforce", icon: UsersRound }, { id: "departments", label: "Departments", icon: LayoutGrid }, { id: "workflows", label: "Workflows", icon: Workflow }, { id: "memory", label: "Memory & Knowledge", icon: BrainCircuit }].map(({ id, label, icon: Icon }) => <button key={id} className={activeNav === id ? "active" : ""} onClick={() => setActiveNav(id)}><Icon size={16} /><span>{label}</span>{id === "workflows" && <b className="nav-badge">2</b>}</button>)}
            </nav>
            <div className="sidebar-label second">WORKSPACE</div>
            <nav className="wf-nav secondary"><button onClick={() => notify("Knowledge source manager opened", "info")}><Database size={16} /><span>Knowledge sources</span></button><button onClick={() => notify("Permission matrix opened", "info")}><ShieldCheck size={16} /><span>Permissions</span></button><button onClick={() => notify("Audit log is ready to inspect", "info")}><Fingerprint size={16} /><span>Audit log</span></button></nav>
            <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><LockKeyhole size={15} /></div><div><strong>Private by design</strong><span>RBAC · approval gates · audit trail</span></div></div><button className="workspace-switcher" onClick={() => notify("Workspace switcher opened", "info")}><div className="mini-orb">P</div><div><strong>Personal Company</strong><span>1 workspace</span></div><MoreHorizontal size={15} /></button></div>
          </aside>

          <section className="wf-content">
            <div className="page-heading"><div><div className="eyebrow"><Sparkles size={13} /> YOUR DIGITAL COMPANY</div><h1>{activeNav === "command" ? "Good morning, Naya." : activeNav === "agents" ? "Your AI workforce." : activeNav === "departments" ? "Departments with purpose." : activeNav === "workflows" ? "Work that runs itself." : "A company that remembers."}</h1><p>{activeNav === "command" ? "Your Right Hand is coordinating the moving pieces." : "Shape the operating system behind your AI workforce."}</p></div><div className="heading-actions"><button className="outline-button" onClick={() => notify("Workspace health is nominal", "info")}><Activity size={15} />Health <span className="health-dot" /></button>{activeNav === "agents" && <button className="primary-button" onClick={() => setShowAgentModal(true)}><Plus size={16} />Add agent</button>}</div></div>

            {activeNav === "command" && <CommandCenter messages={messages} prompt={prompt} setPrompt={setPrompt} sendPrompt={sendPrompt} activeAgent={activeAgent} setActiveAgentId={setActiveAgentId} filteredAgents={filteredAgents} agentSearch={agentSearch} setAgentSearch={setAgentSearch} selectedDepartment={selectedDepartment} setSelectedDepartment={setSelectedDepartment} showInfo={showInfo} setShowInfo={setShowInfo} isAuthenticated={isAuthenticated} planPending={planMutation.isPending} />}
            {activeNav === "agents" && <AgentsView agents={agents} filteredAgents={filteredAgents} agentSearch={agentSearch} setAgentSearch={setAgentSearch} setActiveAgentId={setActiveAgentId} setActiveNav={setActiveNav} />}
            {activeNav === "departments" && <DepartmentsView setActiveNav={setActiveNav} />}
            {activeNav === "workflows" && <WorkflowsView />}
            {activeNav === "memory" && <MemoryView />}
          </section>
        </div>
      </section>
      {showAgentModal && <div className="modal-layer" onClick={() => setShowAgentModal(false)}><div className="wf-modal" onClick={(event) => event.stopPropagation()}><div className="modal-title"><div><span className="eyebrow">WORKFORCE BUILDER</span><h2>Create an agent</h2></div><button className="top-icon" onClick={() => setShowAgentModal(false)}><X size={18} /></button></div><p>Start with an identity. Ari will help you configure its role, memory, tools, and permission boundaries.</p><label>Agent name<input autoFocus value={newAgentName} onChange={(event) => setNewAgentName(event.target.value)} placeholder="e.g. Atlas Research" /></label><div className="agent-draft-grid"><div><span>Default model</span><b>Auto · Right Hand selects</b></div><div><span>Permission profile</span><b>Restricted · approval required</b></div></div><div className="modal-actions"><button className="outline-button" onClick={() => setShowAgentModal(false)}>Cancel</button><button className="primary-button" disabled={!newAgentName.trim()} onClick={addAgent}><Bot size={15} />Create draft</button></div></div></div>}
      {toast && <div className={`wf-toast ${toast.tone}`}><span>{toast.tone === "success" ? <Check size={14} /> : <Sparkles size={14} />}</span>{toast.text}</div>}
      {loading && <div className="loading-indicator"><RefreshCw size={13} /> connecting secure workspace</div>}
    </main>
  );
}

function CommandCenter({ messages, prompt, setPrompt, sendPrompt, activeAgent, setActiveAgentId, filteredAgents, agentSearch, setAgentSearch, selectedDepartment, setSelectedDepartment, showInfo, setShowInfo, isAuthenticated, planPending }: { messages: WorkforceMessage[]; prompt: string; setPrompt: (value: string) => void; sendPrompt: () => void; activeAgent: Agent; setActiveAgentId: (id: string) => void; filteredAgents: Agent[]; agentSearch: string; setAgentSearch: (value: string) => void; selectedDepartment: string; setSelectedDepartment: (value: string) => void; showInfo: boolean; setShowInfo: (value: boolean) => void; isAuthenticated: boolean; planPending: boolean }) {
  return <div className="command-grid">
    <aside className="people-rail"><div className="rail-heading"><div><span className="section-kicker">AI CONTACTS</span><strong>Workforce</strong></div><button className="small-plus" title="Add agent"><Plus size={15} /></button></div><div className="rail-search"><Search size={14} /><input value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} placeholder="Find an agent" /></div><div className="rail-filters"><button className={selectedDepartment === "all" ? "active" : ""} onClick={() => setSelectedDepartment("all")}>All</button><button className={selectedDepartment === "Executive Office" ? "active" : ""} onClick={() => setSelectedDepartment("Executive Office")}>Core</button><button className={selectedDepartment === "Growth & Marketing" ? "active" : ""} onClick={() => setSelectedDepartment("Growth & Marketing")}>Growth</button></div><div className="people-list">{filteredAgents.map((agent) => <button className={`person-row ${activeAgent.id === agent.id ? "selected" : ""}`} key={agent.id} onClick={() => setActiveAgentId(agent.id)}><div className={avatarClass(agent.accent)}>{agent.avatar}<span className={`presence ${agent.status}`} /></div><div><strong>{agent.name}</strong><span>{agent.role}</span><small>{agent.last}</small></div>{agent.status === "working" && <CircleDot size={13} className="working-icon" />}</button>)}</div><div className="rail-footer"><div><span>WORKFORCE CAPACITY</span><strong>68%</strong></div><div className="capacity"><span style={{ width: "68%" }} /></div><small>6 agents · 4 departments · 3 active workflows</small></div></aside>
    <section className="right-hand-chat"><div className="chat-top"><div className="chat-identity"><div className={avatarClass(activeAgent.accent)}>{activeAgent.avatar}<span className={`presence ${activeAgent.status}`} /></div><div><strong>{activeAgent.name}</strong><span>{activeAgent.role}</span></div></div><div className="chat-top-actions"><span className="mode-tag"><Network size={12} /> orchestrated</span><button className="top-icon"><Search size={16} /></button><button className="top-icon"><MoreHorizontal size={16} /></button></div></div><div className="chat-body"><div className="secure-note"><ShieldCheck size={13} /> agent communication is permission-aware and auditable</div><div className="day-marker">TODAY · TUESDAY, SEPTEMBER 8</div>{messages.map((message) => <div className={`wf-message ${message.from === "user" ? "from-user" : ""} ${message.kind === "plan" ? "is-plan" : ""}`} key={message.id}><div className="message-label"><span>{message.sender}</span><time>{message.time}</time></div><div className="message-card">{message.kind === "plan" && <div className="plan-header"><div><Zap size={14} /><strong>Execution plan ready</strong></div><span>LangGraph state · queued</span></div>}<p>{message.body}</p>{message.kind === "plan" && <div className="plan-steps"><span><CheckCircle2 size={13} /> Route agents</span><span><CheckCircle2 size={13} /> Write memory</span><span><Clock3 size={13} /> Approval gate</span></div>}{message.from === "system" && <div className="signal-bar"><Activity size={13} /> live workforce signal <ArrowUpRight size={13} /></div>}</div></div>)}{planPending && <div className="thinking-row"><div className="thinking-dots"><span /><span /><span /></div><span>Ari is planning across the workforce…</span></div>}</div><div className="prompt-dock"><div className="prompt-suggestions"><button onClick={() => setPrompt("Prepare a concise Q2 growth plan with research, owners, and risks")}>Prepare a growth plan</button><button onClick={() => setPrompt("Find the most important decision I should make this week")}>What needs my attention?</button></div><div className="prompt-box"><Sparkles size={17} className="prompt-spark" /><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendPrompt(); } }} placeholder="Tell your company what to do next…" rows={1} /><button className={prompt.trim() ? "send-ready" : ""} onClick={sendPrompt} title={isAuthenticated ? "Run with Right Hand" : "Try demo plan"}>{planPending ? <RefreshCw size={17} className="spin" /> : <Send size={17} />}</button></div><div className="prompt-hint"><LockKeyhole size={11} /> {isAuthenticated ? "Live orchestration enabled" : "Demo mode · sign in to enable live orchestration"}<span>•</span> Enter to send</div></div></section>
    {showInfo && <aside className="operating-panel"><div className="panel-heading"><div><span className="section-kicker">OPERATING SYSTEM</span><strong>Live overview</strong></div><button className="top-icon" onClick={() => setShowInfo(false)}><X size={15} /></button></div><div className="pulse-card"><div className="pulse-orb"><div className="pulse-ring ring-a" /><div className="pulse-ring ring-b" /><BrainCircuit size={22} /></div><div><span>RIGHT HAND PULSE</span><strong>Everything is moving</strong><small>Last coordination · 2 min ago</small></div></div><div className="metric-grid"><div><span>Agents online</span><strong>3 <small>/ 6</small></strong><em>+1 this hour</em></div><div><span>Active workflows</span><strong>12</strong><em>2 need you</em></div><div><span>Memory health</span><strong>94%</strong><em>Syncing well</em></div><div><span>Tasks completed</span><strong>48</strong><em>This week</em></div></div><div className="panel-section"><div className="section-title"><span>Approval queue</span><b>2 pending</b></div><div className="approval-item"><div className="approval-icon amber"><Globe2 size={14} /></div><div><strong>Send campaign to 2,184 leads</strong><span>Mira · Growth & Marketing</span></div><button className="arrow-button"><ArrowUpRight size={14} /></button></div><div className="approval-item"><div className="approval-icon coral"><BriefcaseBusiness size={14} /></div><div><strong>Approve Q2 operating budget</strong><span>Sora · Finance & Operations</span></div><button className="arrow-button"><ArrowUpRight size={14} /></button></div></div><div className="panel-section"><div className="section-title"><span>Recent activity</span><button className="text-button">View all</button></div><div className="activity-line"><div className="activity-dot mint" /><div><strong>Mira updated launch narrative</strong><span>2 min ago · Growth</span></div></div><div className="activity-line"><div className="activity-dot blue" /><div><strong>Elio added 3 product insights</strong><span>19 min ago · Product</span></div></div><div className="activity-line"><div className="activity-dot violet" /><div><strong>Ari wrote a new preference</strong><span>1 hr ago · Memory</span></div></div></div><button className="close-panel" onClick={() => setShowInfo(false)}>Hide live overview <ChevronDown size={13} /></button></aside>}
  </div>;
}

function AgentsView({ agents, filteredAgents, agentSearch, setAgentSearch, setActiveAgentId, setActiveNav }: { agents: Agent[]; filteredAgents: Agent[]; agentSearch: string; setAgentSearch: (value: string) => void; setActiveAgentId: (id: string) => void; setActiveNav: (value: string) => void }) {
  return <div className="directory-view"><div className="directory-toolbar"><div className="toolbar-search"><Search size={15} /><input value={agentSearch} onChange={(event) => setAgentSearch(event.target.value)} placeholder="Search roles, expertise, or departments" /></div><div className="toolbar-meta"><span>Showing {filteredAgents.length} of {agents.length}</span><button className="outline-button"><Archive size={14} />Filters</button></div></div><div className="agent-grid">{filteredAgents.map((agent) => <button className="agent-card" key={agent.id} onClick={() => { setActiveAgentId(agent.id); setActiveNav("command"); }}><div className="agent-card-top"><div className={avatarClass(agent.accent)}>{agent.avatar}<span className={`presence ${agent.status}`} /></div><span className={`status-tag ${agent.status}`}>{agent.status}</span></div><div className="agent-card-copy"><h3>{agent.name}</h3><p>{agent.role}</p><span className="agent-dept"><FolderKanban size={12} />{agent.dept}</span></div><div className="expertise-list">{agent.expertise.map((skill) => <span key={skill}>{skill}</span>)}</div><div className="agent-card-footer"><span><BrainCircuit size={12} /> memory linked</span><ArrowUpRight size={15} /></div></button>)}</div></div>;
}

function DepartmentsView({ setActiveNav }: { setActiveNav: (value: string) => void }) {
  return <div className="directory-view"><div className="dept-summary"><div><span className="section-kicker">ORGANIZATIONAL DESIGN</span><h2>Each department has a mission.</h2><p>Ari can create, staff, and reconfigure departments as your goals change.</p></div><button className="primary-button" onClick={() => setActiveNav("agents")}><Plus size={15} />Add department</button></div><div className="department-grid">{departmentSeed.map((dept) => <button className="department-card" key={dept.id} onClick={() => setActiveNav("agents")}><div className={`dept-mark ${dept.color}`}><Network size={18} /></div><div className="department-card-copy"><span>{dept.count} AI agents</span><h3>{dept.name}</h3><p>{dept.purpose}</p></div><div className="dept-footer"><span>{dept.trend}</span><ArrowUpRight size={15} /></div></button>)}</div><div className="architecture-card"><div className="arch-copy"><span className="section-kicker">AUTONOMOUS ORGANIZATION</span><h2>One Right Hand. Many specialized minds.</h2><p>Every agent inherits workspace guardrails, then adds its own role, memory, tools, and permission boundary. Collaboration happens in context — not in a maze of disconnected bots.</p></div><div className="arch-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><BrainCircuit size={23} /><span>Ari</span></div><div className="orbit-node node-a">M</div><div className="orbit-node node-b">E</div><div className="orbit-node node-c">N</div></div></div></div>;
}

function WorkflowsView() {
  return <div className="directory-view"><div className="workflow-summary"><div><span className="section-kicker">AUTOMATION LAYER</span><h2>Workflows that keep moving.</h2><p>LangGraph state, approval gates, durable runs, and visible handoffs — all in one operating view.</p></div><button className="primary-button"><Plus size={15} />New workflow</button></div><div className="workflow-list">{workflowSeed.map((flow) => { const Icon = flow.icon; return <div className="workflow-card" key={flow.name}><div className={`workflow-icon ${flow.color}`}><Icon size={18} /></div><div className="workflow-copy"><div className="workflow-title"><h3>{flow.name}</h3><span className={`workflow-status ${flow.status.toLowerCase().replace(" ", "-")}`}>{flow.status}</span></div><p>Owned by {flow.owner} · next checkpoint {flow.next}</p><div className="progress-track"><span style={{ width: `${flow.progress}%` }} /></div></div><div className="workflow-percent">{flow.progress}%<small>complete</small></div><button className="top-icon"><MoreHorizontal size={16} /></button></div>; })}</div><div className="workflow-architecture"><div className="workflow-arch-head"><div><span className="section-kicker">GRAPH RUNTIME</span><h3>Planning → routing → approval → execution</h3></div><span className="runtime-chip"><GitBranch size={13} /> LangGraph foundation</span></div><div className="flow-steps"><div className="flow-step done"><span>01</span><strong>Understand</strong><small>Intent + context</small></div><div className="flow-connector active" /><div className="flow-step done"><span>02</span><strong>Route</strong><small>Best-fit agents</small></div><div className="flow-connector active" /><div className="flow-step waiting"><span>03</span><strong>Approval gate</strong><small>Human when needed</small></div><div className="flow-connector" /><div className="flow-step"><span>04</span><strong>Execute</strong><small>Tools + memory</small></div><div className="flow-connector" /><div className="flow-step"><span>05</span><strong>Audit</strong><small>Trace everything</small></div></div></div></div>;
}

function MemoryView() {
  return <div className="directory-view"><div className="memory-hero"><div><span className="section-kicker">SHARED INTELLIGENCE</span><h2>Your company remembers what matters.</h2><p>Long-term memory is scoped, attributable, and permission-aware — so every agent knows more without knowing too much.</p></div><div className="memory-score"><span>MEMORY HEALTH</span><strong>94<span>%</span></strong><small>+7% this week</small></div></div><div className="memory-toolbar"><div className="toolbar-search"><Search size={15} /><input placeholder="Search memory, knowledge, and policies" /></div><button className="outline-button"><FileText size={14} />Add knowledge</button></div><div className="memory-list">{memorySeed.map((memory) => <div className="memory-row" key={memory.title}><div className="memory-kind"><BrainCircuit size={15} /></div><div className="memory-copy"><h3>{memory.title}</h3><span>{memory.type} · owned by {memory.agent}</span></div><div className="memory-score-mini"><strong>{memory.score}</strong><span>relevance</span></div><div className="memory-updated">{memory.updated}</div><button className="top-icon"><MoreHorizontal size={16} /></button></div>)}</div><div className="memory-footnote"><LockKeyhole size={14} /> Memory writes follow workspace permissions and are visible in the audit log.</div></div>;
}
