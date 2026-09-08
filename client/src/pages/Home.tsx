import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Archive, ArrowLeft, Check, CheckCheck, ChevronDown, Copy, Forward, Info, Menu, MessageCircle, MoreVertical, Paperclip, Phone, Plus, Search, Send, Settings, Smile, UserPlus, Users, Video, X } from "lucide-react";

type Agent = { id: string; name: string; role: string; avatar: string; accent: string; status: string; department: string };
type Chat = { id: string; name: string; subtitle: string; avatar: string; accent: string; kind: "direct" | "group"; last: string; time: string; unread?: number; members?: string[] };
type Message = { id: string; chatId: string; sender: string; senderAvatar: string; text: string; time: string; fromMe?: boolean; starred?: boolean };

type Accent = "green" | "blue" | "purple" | "orange" | "red" | "cyan";
const agentSeed: Agent[] = [
  { id: "ari", name: "Ari", role: "AI Right Hand · Chief of Staff", avatar: "AR", accent: "green", status: "online", department: "Executive Office" },
  { id: "mira", name: "Mira Chen", role: "Head of Growth Intelligence", avatar: "MC", accent: "purple", status: "working", department: "Growth & Marketing" },
  { id: "elio", name: "Elio Park", role: "Product Strategy Lead", avatar: "EP", accent: "blue", status: "online", department: "Product & Design" },
  { id: "noor", name: "Noor Patel", role: "Research Analyst", avatar: "NP", accent: "orange", status: "working", department: "Research & Intelligence" },
  { id: "sora", name: "Sora Kim", role: "Finance Controller", avatar: "SK", accent: "red", status: "offline", department: "Finance & Operations" },
  { id: "jax", name: "Jax Rivera", role: "Automation Engineer", avatar: "JR", accent: "cyan", status: "online", department: "Engineering & Automation" },
];
const initialChats: Chat[] = [
  { id: "ari", name: "Ari", subtitle: "online", avatar: "AR", accent: "green", kind: "direct", last: "Tell me what you want to move forward.", time: "09:41" },
  { id: "launch", name: "Launch squad", subtitle: "Ari, Mira, Noor, you", avatar: "LS", accent: "purple", kind: "group", last: "Mira: first pass is ready", time: "09:44", unread: 2, members: ["Ari", "Mira Chen", "Noor Patel"] },
  { id: "mira", name: "Mira Chen", subtitle: "Growth & Marketing · working", avatar: "MC", accent: "purple", kind: "direct", last: "I prepared the launch narrative.", time: "09:44" },
  { id: "elio", name: "Elio Park", subtitle: "Product & Design · online", avatar: "EP", accent: "blue", kind: "direct", last: "Roadmap options are ready.", time: "Yesterday" },
  { id: "ops", name: "Operations room", subtitle: "Sora, Jax, you", avatar: "OP", accent: "orange", kind: "group", last: "Workflow approval needed", time: "Yesterday", members: ["Sora Kim", "Jax Rivera"] },
];
const initialMessages: Message[] = [
  { id: "m1", chatId: "ari", sender: "Ari", senderAvatar: "AR", text: "Good morning, Naya. Tell me what you want to move forward — I’ll bring in the right AI people and keep you in the loop.", time: "09:41" },
  { id: "m2", chatId: "ari", sender: "You", senderAvatar: "N", text: "I want to understand what needs my attention this week.", time: "09:42", fromMe: true },
  { id: "m3", chatId: "ari", sender: "Ari", senderAvatar: "AR", text: "I’ll scan the workforce and prepare a short decision list. I’ll ask before anything external or high-risk.", time: "09:42" },
  { id: "m4", chatId: "launch", sender: "Mira Chen", senderAvatar: "MC", text: "I prepared the first pass of the launch narrative.", time: "09:44" },
];

function avatarClass(accent: string) { return `wa-avatar wa-${accent}`; }
function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const snapshot = trpc.workforce.snapshot.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const planMutation = trpc.rightHand.plan.useMutation();
  const [chats, setChats] = useState(initialChats);
  const [messages, setMessages] = useState(initialMessages);
  const [activeChatId, setActiveChatId] = useState("ari");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>(["Ari"]);
  const [toast, setToast] = useState("");

  const persistedAgents: Agent[] = (snapshot.data?.agents ?? []).map((agent) => ({ id: String(agent.id), name: agent.name, role: agent.role, avatar: agent.avatar, accent: agent.accent, status: agent.status, department: agent.departmentId ? `Department ${agent.departmentId}` : "Executive Office" }));
  const agents = persistedAgents.length ? persistedAgents : agentSeed;
  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];
  const activeAgent = agents.find((agent) => agent.name === activeChat?.name) ?? agents.find((agent) => agent.name === "Ari") ?? agentSeed[0];
  const visibleChats = useMemo(() => chats.filter((chat) => `${chat.name} ${chat.subtitle} ${chat.last}`.toLowerCase().includes(search.toLowerCase())), [chats, search]);
  const activeMessages = messages.filter((message) => message.chatId === activeChatId);

  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2200); };
  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || planMutation.isPending) return;
    const newMessage: Message = { id: `msg-${Date.now()}`, chatId: activeChatId, sender: user?.name ?? "You", senderAvatar: user?.name ? initials(user.name) : "N", text, time: "now", fromMe: true };
    setMessages((current) => [...current, newMessage]);
    setMessageText("");
    setChats((current) => current.map((chat) => chat.id === activeChatId ? { ...chat, last: text, time: "now", unread: 0 } : chat));
    if (activeChatId === "ari") {
      try {
        const result = isAuthenticated ? await planMutation.mutateAsync({ request: text }) : null;
        const reply = result?.plan.summary ?? "Saya mengerti. Saya akan mengubah permintaan ini menjadi langkah yang jelas dan meminta persetujuan sebelum tindakan berisiko.";
        setMessages((current) => [...current, { id: `reply-${Date.now()}`, chatId: activeChatId, sender: "Ari", senderAvatar: "AR", text: reply, time: "now" }]);
      } catch { notify("Ari belum bisa merespons. Coba lagi sebentar."); }
    }
  };
  const copyMessage = async (message: Message) => { await navigator.clipboard?.writeText(message.text); setSelectedMessage(null); notify("Pesan disalin"); };
  const forwardMessage = (message: Message) => { setMessageText(`Forwarded: ${message.text}`); setSelectedMessage(null); notify("Pesan siap diteruskan"); };
  const createGroup = () => {
    const name = groupName.trim();
    if (!name) return;
    const group: Chat = { id: `group-${Date.now()}`, name, subtitle: `${groupMembers.join(", ")}, you`, avatar: initials(name), accent: "green", kind: "group", last: "Group created", time: "now", members: groupMembers };
    setChats((current) => [group, ...current]);
    setActiveChatId(group.id); setMessages((current) => [...current, { id: `system-${Date.now()}`, chatId: group.id, sender: "System", senderAvatar: "WA", text: `You created the group “${name}”`, time: "now" }]);
    setGroupName(""); setGroupMembers(["Ari"]); setShowGroupModal(false); setShowNewMenu(false); notify("Grup AI dibuat");
  };

  return <main className="whatsapp-shell">
    <section className="whatsapp-app">
      <aside className="wa-sidebar">
        <header className="wa-sidebar-header"><div className="wa-brand"><span className="wa-brand-mark"><MessageCircle size={20} /></span><strong>whisp</strong></div><div className="wa-header-actions"><button className="wa-icon-button" title="New chat" onClick={() => setShowNewMenu((value) => !value)}><Plus size={20} /></button><button className="wa-icon-button" title="Menu"><MoreVertical size={20} /></button></div>{showNewMenu && <div className="wa-new-menu"><button onClick={() => { setShowGroupModal(true); setShowNewMenu(false); }}><Users size={16} />New AI group</button><button onClick={() => notify("Search an AI contact from the list")}><UserPlus size={16} />New chat</button></div>}</header>
        <div className="wa-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search or start new chat" /></div>
        <div className="wa-filter-row"><button className="active">All</button><button>Unread</button><button>Groups</button></div>
        <div className="wa-chat-list">{visibleChats.map((chat) => <button key={chat.id} className={`wa-chat-row ${activeChatId === chat.id ? "active" : ""}`} onClick={() => { setActiveChatId(chat.id); setSelectedMessage(null); setMobileChatOpen(true); }}><div className={avatarClass(chat.accent)}>{chat.avatar}<span className="wa-online" /></div><div className="wa-chat-row-copy"><div><strong>{chat.name}</strong><time>{chat.time}</time></div><div><span>{chat.last}</span>{chat.unread ? <b>{chat.unread}</b> : null}</div></div></button>)}</div>
        <footer className="wa-sidebar-footer"><div className="wa-small-avatar">{isAuthenticated ? (user?.name?.[0] ?? "N") : "N"}</div><div><strong>{isAuthenticated ? user?.name ?? "Naya" : "Naya"}</strong><span>{isAuthenticated ? "Connected" : "Demo mode"}</span></div><button className="wa-icon-button" onClick={() => isAuthenticated ? notify("Account settings") : startLogin()}><Settings size={18} /></button></footer>
      </aside>
      <section className={`wa-chat-window ${mobileChatOpen ? "mobile-open" : ""}`}>
        <header className="wa-chat-header"><button className="wa-mobile-back" onClick={() => setMobileChatOpen(false)}><ArrowLeft size={20} /></button><div className={avatarClass(activeChat.accent)}>{activeChat.avatar}<span className="wa-online" /></div><div className="wa-chat-header-copy"><strong>{activeChat.name}</strong><span>{activeChat.kind === "group" ? `${activeChat.members?.length ?? 0} AI agents · you` : activeChat.subtitle}</span></div><div className="wa-chat-header-actions"><button className="wa-icon-button"><Search size={19} /></button><button className="wa-icon-button" onClick={() => setShowChatInfo((value) => !value)}><Info size={19} /></button><button className="wa-icon-button"><MoreVertical size={19} /></button></div></header>
        <div className="wa-chat-body"><div className="wa-encryption"><Info size={12} /> Messages are end-to-end permission aware. Only this workforce can see them.</div><div className="wa-day">TODAY</div>{activeMessages.map((message) => <div key={message.id} className={`wa-message-row ${message.fromMe ? "mine" : ""}`} onMouseLeave={() => setSelectedMessage(null)}><div className={`wa-bubble ${message.fromMe ? "mine" : ""}`} onContextMenu={(event) => { event.preventDefault(); setSelectedMessage(message.id); }}><p>{message.text}</p><span>{message.time} {message.fromMe && <CheckCheck size={15} className="wa-read" />}</span>{selectedMessage === message.id && <div className="wa-message-actions"><button onClick={() => copyMessage(message)}><Copy size={14} />Copy</button><button onClick={() => forwardMessage(message)}><Forward size={14} />Forward</button></div>}</div></div>)}{planMutation.isPending && <div className="wa-typing"><span /><span /><span /> Ari is typing…</div>}</div>
        <div className="wa-composer"><button className="wa-icon-button"><Smile size={23} /></button><button className="wa-icon-button"><Paperclip size={21} /></button><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Type a message" rows={1} /><button className="wa-send-button" onClick={() => void sendMessage()}>{messageText.trim() ? <Send size={19} /> : <MessageCircle size={20} />}</button></div>
      </section>
      {showChatInfo && <aside className="wa-info-panel"><header><strong>Contact info</strong><button className="wa-icon-button" onClick={() => setShowChatInfo(false)}><X size={19} /></button></header><div className="wa-info-profile"><div className={avatarClass(activeChat.accent)}>{activeChat.avatar}</div><h2>{activeChat.name}</h2><span>{activeChat.kind === "group" ? "AI workforce group" : activeAgent.role}</span></div><div className="wa-info-section"><span>ABOUT</span><p>{activeChat.kind === "group" ? `${activeChat.members?.join(", ")}` : "AI agent connected to your digital company"}</p></div><div className="wa-info-section"><span>WORKFORCE</span><p>Memory, tools, workflows, and permissions are managed by AI Right Hand.</p></div></aside>}
    </section>
    {showGroupModal && <div className="wa-modal-layer" onClick={() => setShowGroupModal(false)}><div className="wa-modal" onClick={(event) => event.stopPropagation()}><header><strong>New AI group</strong><button className="wa-icon-button" onClick={() => setShowGroupModal(false)}><X size={19} /></button></header><label>Group name<input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Q2 Launch Team" /></label><span className="wa-modal-label">Add AI agents</span><div className="wa-member-list">{agents.map((agent) => <button key={agent.id} className={groupMembers.includes(agent.name) ? "selected" : ""} onClick={() => setGroupMembers((members) => members.includes(agent.name) ? members.filter((member) => member !== agent.name) : [...members, agent.name])}><div className={avatarClass(agent.accent)}>{agent.avatar}</div><span>{agent.name}</span><Check size={16} /></button>)}</div><button className="wa-create-group" disabled={!groupName.trim() || groupMembers.length === 0} onClick={createGroup}>Create group</button></div></div>}
    {toast && <div className="wa-toast">{toast}</div>}
  </main>;
}
