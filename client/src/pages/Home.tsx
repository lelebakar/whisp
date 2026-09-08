import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, Copy, Edit3, FileAudio, FileText, Forward, Info, MessageCircle, MoreVertical, Paperclip, Plus, Search, Send, Settings, Smile, Star, Trash2, UserPlus, Users, X } from "lucide-react";

type Agent = { id: string; name: string; role: string; avatar: string; accent: string; status: string; department: string };
type Chat = { id: string; serverId?: number; name: string; subtitle: string; avatar: string; accent: string; kind: "direct" | "group"; last: string; time: string; unread?: number; members?: string[] };
type Message = { id: string; serverId?: number; chatId: string; sender: string; senderAvatar: string; text: string; time: string; fromMe?: boolean; starred?: boolean; replyTo?: string; deleted?: boolean };

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
  const chatSnapshot = trpc.chats.snapshot.useQuery(undefined, { enabled: isAuthenticated, refetchOnWindowFocus: false });
  const chatUtils = trpc.useUtils();
  const planMutation = trpc.rightHand.plan.useMutation();
  const chatCreateMutation = trpc.chats.create.useMutation();
  const chatSendMutation = trpc.chats.send.useMutation();
  const chatUpdateMutation = trpc.chats.updateMessage.useMutation();
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
  const [messageSearch, setMessageSearch] = useState("");
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunks = useRef<Blob[]>([]);

  const persistedAgents: Agent[] = (snapshot.data?.agents ?? []).map((agent) => ({ id: String(agent.id), name: agent.name, role: agent.role, avatar: agent.avatar, accent: agent.accent, status: agent.status, department: agent.departmentId ? `Department ${agent.departmentId}` : "Executive Office" }));
  const agents = persistedAgents.length ? persistedAgents : agentSeed;
  const persistedChats: Chat[] = (chatSnapshot.data?.chats ?? []).map((chat) => ({ serverId: chat.id, id: `db-${chat.id}`, name: chat.name, subtitle: chat.kind === "group" ? "AI workforce group" : "online", avatar: initials(chat.name), accent: chat.kind === "group" ? "purple" : "green", kind: chat.kind === "group" ? "group" : "direct", last: "No messages yet", time: "now" }));
  const visibleChatData = persistedChats.length ? persistedChats : chats;
  const activeChat = visibleChatData.find((chat) => chat.id === activeChatId) ?? visibleChatData[0];
  const activeAgent = agents.find((agent) => agent.name === activeChat?.name) ?? agents.find((agent) => agent.name === "Ari") ?? agentSeed[0];
  const persistedMessages: Message[] = (chatSnapshot.data?.messages ?? []).filter((message) => !message.deletedAt || message.content).map((message) => ({ serverId: message.id, id: `db-msg-${message.id}`, chatId: `db-${message.conversationId}`, sender: message.senderAgentId ? agents.find((agent) => Number(agent.id) === message.senderAgentId)?.name ?? "AI agent" : "You", senderAvatar: message.senderAgentId ? agents.find((agent) => Number(agent.id) === message.senderAgentId)?.avatar ?? "AI" : "N", text: message.content, time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), fromMe: !message.senderAgentId, starred: message.isStarred, deleted: Boolean(message.deletedAt) }));
  const visibleChats = useMemo(() => visibleChatData.filter((chat) => `${chat.name} ${chat.subtitle} ${chat.last}`.toLowerCase().includes(search.toLowerCase())), [visibleChatData, search]);
  const allActiveMessages = persistedMessages.length ? persistedMessages.filter((message) => message.chatId === activeChat?.id) : messages.filter((message) => message.chatId === activeChat?.id);
  const activeMessages = allActiveMessages.filter((message) => !messageSearch || message.text.toLowerCase().includes(messageSearch.toLowerCase()));

  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2200); };
  const sendMessage = async (attachment?: File) => {
    const text = messageText.trim();
    const outgoingText = text || (attachment ? `📎 ${attachment.name}` : "");
    if (!outgoingText || planMutation.isPending || !activeChat) return;
    const newMessage: Message = { id: `msg-${Date.now()}`, chatId: activeChat.id, sender: user?.name ?? "You", senderAvatar: user?.name ? initials(user.name) : "N", text: outgoingText, time: "now", fromMe: true, replyTo: replyingTo?.text };
    setMessages((current) => [...current, newMessage]);
    setMessageText(""); setReplyingTo(null); setEditingMessage(null); setEmojiOpen(false);
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, last: outgoingText, time: "now", unread: 0 } : chat));
    let persistedMessageId: number | undefined;
    let conversationId = activeChat.serverId;
    if (isAuthenticated && !conversationId) {
      const directAgent = agents.find((agent) => agent.name === activeChat.name) ?? agents.find((agent) => agent.name === "Ari");
      const createdConversation = await chatCreateMutation.mutateAsync({ name: activeChat.name, kind: activeChat.name === "Ari" ? "right_hand" : "direct", description: activeChat.subtitle, agentIds: directAgent && Number.isFinite(Number(directAgent.id)) ? [Number(directAgent.id)] : [] });
      conversationId = createdConversation?.id;
    }
    if (isAuthenticated && conversationId) {
      const persisted = await chatSendMutation.mutateAsync({ conversationId, content: outgoingText, parentMessageId: replyingTo?.serverId });
      persistedMessageId = persisted?.id;
      if (attachment && persistedMessageId) await uploadAttachment(attachment, persistedMessageId);
      await chatUtils.chats.snapshot.invalidate();
    }
    if (activeChat.name === "Ari" && !attachment) {
      try {
        const result = isAuthenticated ? await planMutation.mutateAsync({ request: text }) : null;
        const reply = result?.plan.summary ?? "Saya mengerti. Saya akan mengubah permintaan ini menjadi langkah yang jelas dan meminta persetujuan sebelum tindakan berisiko.";
        setMessages((current) => [...current, { id: `reply-${Date.now()}`, chatId: activeChat.id, sender: "Ari", senderAvatar: "AR", text: reply, time: "now" }]);
      } catch { notify("Ari belum bisa merespons. Coba lagi sebentar."); }
    }
  };
  const uploadAttachment = async (file: File, messageId: number) => { const form = new FormData(); form.append("file", file); form.append("messageId", String(messageId)); const response = await fetch("/api/chat/upload", { method: "POST", body: form, credentials: "include" }); if (!response.ok) notify("Upload gagal"); else notify("File terkirim"); };
  const copyMessage = async (message: Message) => { await navigator.clipboard?.writeText(message.text); setSelectedMessage(null); notify("Pesan disalin"); };
  const forwardMessage = (message: Message) => { setMessageText(`Forwarded: ${message.text}`); setSelectedMessage(null); notify("Pesan siap diteruskan"); };
  const replyMessage = (message: Message) => { setReplyingTo(message); setSelectedMessage(null); };
  const editMessage = async (message: Message) => { const next = window.prompt("Edit message", message.text); if (!next?.trim()) return; setMessages((current) => current.map((item) => item.id === message.id ? { ...item, text: next.trim() } : item)); if (isAuthenticated && message.serverId) await chatUpdateMutation.mutateAsync({ id: message.serverId, content: next.trim() }); setSelectedMessage(null); notify("Pesan diedit"); };
  const deleteMessage = async (message: Message) => { setMessages((current) => current.map((item) => item.id === message.id ? { ...item, text: "This message was deleted", deleted: true } : item)); if (isAuthenticated && message.serverId) await chatUpdateMutation.mutateAsync({ id: message.serverId, deleted: true }); setSelectedMessage(null); notify("Pesan dihapus"); };
  const toggleStar = async (message: Message) => { const starred = !message.starred; setMessages((current) => current.map((item) => item.id === message.id ? { ...item, starred } : item)); if (isAuthenticated && message.serverId) await chatUpdateMutation.mutateAsync({ id: message.serverId, isStarred: starred }); setSelectedMessage(null); notify(starred ? "Pesan berbintang" : "Bintang dihapus"); };
  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) return;
    const selectedAgentIds = agents.filter((agent) => groupMembers.includes(agent.name)).map((agent) => Number(agent.id)).filter(Number.isFinite);
    const persisted = isAuthenticated ? await chatCreateMutation.mutateAsync({ name, kind: "group", description: "AI workforce group", agentIds: selectedAgentIds }) : null;
    const group: Chat = { serverId: persisted?.id, id: persisted ? `db-${persisted.id}` : `group-${Date.now()}`, name, subtitle: `${groupMembers.join(", ")}, you`, avatar: initials(name), accent: "green", kind: "group", last: "Group created", time: "now", members: groupMembers };
    setChats((current) => [group, ...current]);
    setActiveChatId(group.id); setMessages((current) => [...current, { id: `system-${Date.now()}`, chatId: group.id, sender: "System", senderAvatar: "WA", text: `You created the group “${name}”`, time: "now" }]);
    if (persisted) await chatUtils.chats.snapshot.invalidate();
    setGroupName(""); setGroupMembers(["Ari"]); setShowGroupModal(false); setShowNewMenu(false); notify("Grup AI dibuat");
  };
  const addEmoji = (emoji: string) => setMessageText((text) => `${text}${emoji}`);
  const startVoiceNote = async () => { if (recording) { recorderRef.current?.stop(); setRecording(false); return; } if (!navigator.mediaDevices?.getUserMedia) { notify("Voice note tidak didukung browser ini"); return; } const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const recorder = new MediaRecorder(stream); recorderChunks.current = []; recorder.ondataavailable = (event) => recorderChunks.current.push(event.data); recorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); const file = new File([new Blob(recorderChunks.current, { type: "audio/webm" })], `voice-note-${Date.now()}.webm`, { type: "audio/webm" }); void sendMessage(file); }; recorder.start(); recorderRef.current = recorder; setRecording(true); notify("Merekam voice note… klik mic lagi untuk selesai"); };

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
        <header className="wa-chat-header"><button className="wa-mobile-back" onClick={() => setMobileChatOpen(false)}><ArrowLeft size={20} /></button><div className={avatarClass(activeChat.accent)}>{activeChat.avatar}<span className="wa-online" /></div><div className="wa-chat-header-copy"><strong>{activeChat.name}</strong><span>{activeChat.kind === "group" ? `${activeChat.members?.length ?? 0} AI agents · you` : activeChat.subtitle}</span></div>{messageSearchOpen && <input className="wa-message-search" autoFocus value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" />}{!messageSearchOpen && <div className="wa-chat-header-actions"><button className="wa-icon-button" onClick={() => setMessageSearchOpen(true)}><Search size={19} /></button><button className="wa-icon-button" onClick={() => setShowChatInfo((value) => !value)}><Info size={19} /></button><button className="wa-icon-button"><MoreVertical size={19} /></button></div>}</header>
        <div className={`wa-chat-body ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void sendMessage(file); }}><div className="wa-encryption"><Info size={12} /> Messages are end-to-end permission aware. Only this workforce can see them.</div>{dragging && <div className="wa-drop-zone">Drop file to send</div>}<div className="wa-day">TODAY</div>{activeMessages.map((message) => <div key={message.id} className={`wa-message-row ${message.fromMe ? "mine" : ""}`} onMouseLeave={() => setSelectedMessage(null)}><div className={`wa-bubble ${message.fromMe ? "mine" : ""} ${message.deleted ? "deleted" : ""}`} onContextMenu={(event) => { event.preventDefault(); setSelectedMessage(message.id); }}><p>{message.replyTo && <small className="wa-reply-ref">↩ {message.replyTo}</small>}{message.text}{message.starred && <Star size={12} className="wa-starred" fill="currentColor" />}</p><span>{message.time} {message.fromMe && <CheckCheck size={15} className="wa-read" />}</span>{selectedMessage === message.id && <div className="wa-message-actions"><button onClick={() => replyMessage(message)}><Forward size={14} />Reply</button><button onClick={() => copyMessage(message)}><Copy size={14} />Copy</button><button onClick={() => forwardMessage(message)}><Forward size={14} />Forward</button><button onClick={() => toggleStar(message)}><Star size={14} />Star</button>{message.fromMe && !message.deleted && <button onClick={() => void editMessage(message)}><Edit3 size={14} />Edit</button>}{message.fromMe && !message.deleted && <button onClick={() => void deleteMessage(message)}><Trash2 size={14} />Delete</button>}</div>}</div></div>)}{planMutation.isPending && <div className="wa-typing"><span /><span /><span /> Ari is typing…</div>}</div>
        {replyingTo && <div className="wa-reply-compose"><span><b>Replying to {replyingTo.sender}</b>{replyingTo.text}</span><button className="wa-icon-button" onClick={() => setReplyingTo(null)}><X size={16} /></button></div>}
        <div className="wa-composer"><div className="wa-emoji-wrap"><button className="wa-icon-button" onClick={() => setEmojiOpen((value) => !value)}><Smile size={23} /></button>{emojiOpen && <div className="wa-emoji-picker">{["😀","😂","😍","🥳","👍","🙏","🔥","✅","💡","🚀","🎉","❤️"].map((emoji) => <button key={emoji} onClick={() => addEmoji(emoji)}>{emoji}</button>)}</div>}</div><button className="wa-icon-button" onClick={() => fileInputRef.current?.click()}><Paperclip size={21} /></button><input ref={fileInputRef} hidden type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void sendMessage(file); event.target.value = ""; }} /><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder={recording ? "Recording voice note…" : "Type a message"} rows={1} /><button className={`wa-icon-button ${recording ? "recording" : ""}`} onClick={() => void startVoiceNote()}><FileAudio size={20} /></button><button className="wa-send-button" onClick={() => void sendMessage()}>{messageText.trim() ? <Send size={19} /> : <MessageCircle size={20} />}</button></div>
      </section>
      {showChatInfo && <aside className="wa-info-panel"><header><strong>Contact info</strong><button className="wa-icon-button" onClick={() => setShowChatInfo(false)}><X size={19} /></button></header><div className="wa-info-profile"><div className={avatarClass(activeChat.accent)}>{activeChat.avatar}</div><h2>{activeChat.name}</h2><span>{activeChat.kind === "group" ? "AI workforce group" : activeAgent.role}</span></div><div className="wa-info-section"><span>ABOUT</span><p>{activeChat.kind === "group" ? `${activeChat.members?.join(", ")}` : "AI agent connected to your digital company"}</p></div><div className="wa-info-section"><span>WORKFORCE</span><p>Memory, tools, workflows, and permissions are managed by AI Right Hand.</p></div></aside>}
    </section>
    {showGroupModal && <div className="wa-modal-layer" onClick={() => setShowGroupModal(false)}><div className="wa-modal" onClick={(event) => event.stopPropagation()}><header><strong>New AI group</strong><button className="wa-icon-button" onClick={() => setShowGroupModal(false)}><X size={19} /></button></header><label>Group name<input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Q2 Launch Team" /></label><span className="wa-modal-label">Add AI agents</span><div className="wa-member-list">{agents.map((agent) => <button key={agent.id} className={groupMembers.includes(agent.name) ? "selected" : ""} onClick={() => setGroupMembers((members) => members.includes(agent.name) ? members.filter((member) => member !== agent.name) : [...members, agent.name])}><div className={avatarClass(agent.accent)}>{agent.avatar}</div><span>{agent.name}</span><Check size={16} /></button>)}</div><button className="wa-create-group" disabled={!groupName.trim() || groupMembers.length === 0} onClick={createGroup}>Create group</button></div></div>}
    {toast && <div className="wa-toast">{toast}</div>}
  </main>;
}
