import {
  Archive,
  ArrowLeft,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Copy,
  Download,
  FileText,
  Forward,
  Group,
  Image as ImageIcon,
  Info,
  Link2,
  LockKeyhole,
  Menu,
  Mic,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  SquarePen,
  Star,
  Trash2,
  UserPlus,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Chat = {
  id: string;
  name: string;
  initials: string;
  tone: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  pinned?: boolean;
  muted?: boolean;
  isGroup?: boolean;
  members?: number;
};

type Message = {
  id: string;
  text: string;
  from: "me" | "them";
  time: string;
  status?: "sent" | "read";
  starred?: boolean;
  replyTo?: string;
  kind?: "text" | "file";
};

type ToastKind = "success" | "info";

type ToastState = { message: string; kind: ToastKind } | null;

const contactOptions = [
  { id: "rani", name: "Rani Putri", initials: "RP", tone: "coral" },
  { id: "dimas", name: "Dimas Pratama", initials: "DP", tone: "blue" },
  { id: "sophie", name: "Sophie Laurent", initials: "SL", tone: "purple" },
  { id: "fajar", name: "Fajar Nugroho", initials: "FN", tone: "amber" },
  { id: "maya", name: "Maya Sari", initials: "MS", tone: "mint" },
];

const seedChats: Chat[] = [
  {
    id: "rani",
    name: "Rani Putri",
    initials: "RP",
    tone: "coral",
    preview: "Oke, aku kirim brief-nya ya",
    time: "10:42",
    unread: 2,
    online: true,
    pinned: true,
  },
  {
    id: "tim-studio",
    name: "Tim Studio ✦",
    initials: "TS",
    tone: "mint",
    preview: "Dimas: file final sudah naik",
    time: "09:18",
    unread: 5,
    pinned: true,
    isGroup: true,
    members: 8,
  },
  {
    id: "dimas",
    name: "Dimas Pratama",
    initials: "DP",
    tone: "blue",
    preview: "Siap, sampai ketemu besok!",
    time: "Kemarin",
    unread: 0,
    online: false,
  },
  {
    id: "keluarga",
    name: "Keluarga Besar",
    initials: "KB",
    tone: "amber",
    preview: "Ibu: Jangan lupa makan siang",
    time: "Kemarin",
    unread: 0,
    muted: true,
    isGroup: true,
    members: 12,
  },
  {
    id: "sophie",
    name: "Sophie Laurent",
    initials: "SL",
    tone: "purple",
    preview: "Photo",
    time: "Senin",
    unread: 0,
    online: true,
  },
  {
    id: "fajar",
    name: "Fajar Nugroho",
    initials: "FN",
    tone: "orange",
    preview: "Voice message",
    time: "Minggu",
    unread: 0,
    muted: true,
  },
];

const seedMessages: Record<string, Message[]> = {
  rani: [
    { id: "r-1", text: "Hai Naya! Udah lihat moodboard yang aku kirim?", from: "them", time: "10:32" },
    { id: "r-2", text: "Sudah dong, aku suka banget sama arahnya. Warna hijaunya pas ✨", from: "me", time: "10:35", status: "read" },
    { id: "r-3", text: "Kan! Aku kepikiran buat bikin sedikit lebih hangat di bagian background.", from: "them", time: "10:36" },
    { id: "r-4", text: "Setuju. Mungkin pakai off-white dengan sedikit grain biar terasa lebih hidup.", from: "me", time: "10:38", status: "read" },
    { id: "r-5", text: "Oke, aku kirim brief-nya ya", from: "them", time: "10:42" },
  ],
  "tim-studio": [
    { id: "t-1", text: "Morning team, quick sync jam 11?", from: "them", time: "08:54" },
    { id: "t-2", text: "Aku bisa join. Sekalian review final screens.", from: "me", time: "08:58", status: "read" },
    { id: "t-3", text: "Dimas: file final sudah naik", from: "them", time: "09:18" },
  ],
  dimas: [
    { id: "d-1", text: "Bro, deck presentasinya aman untuk besok?", from: "them", time: "Kemarin" },
    { id: "d-2", text: "Sudah aku cek dua kali. Siap, sampai ketemu besok!", from: "me", time: "Kemarin", status: "read" },
  ],
  keluarga: [
    { id: "k-1", text: "Minggu ini jadi kumpul di rumah Ibu?", from: "them", time: "Kemarin" },
    { id: "k-2", text: "Jadi, jam 12 siang ya. Jangan telat 😄", from: "me", time: "Kemarin", status: "read" },
    { id: "k-3", text: "Ibu: Jangan lupa makan siang", from: "them", time: "Kemarin" },
  ],
  sophie: [
    { id: "s-1", text: "The new direction feels very clear. Love it!", from: "them", time: "Senin" },
    { id: "s-2", text: "Thank you! I will send the updated type scale later today.", from: "me", time: "Senin", status: "read" },
  ],
  fajar: [
    { id: "f-1", text: "Voice message", from: "them", time: "Minggu", kind: "file" },
    { id: "f-2", text: "Aku dengerin nanti sore ya.", from: "me", time: "Minggu", status: "read" },
  ],
};

const formatNow = () =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

export default function Home() {
  const [chats, setChats] = useState(seedChats);
  const [messagesByChat, setMessagesByChat] = useState(seedMessages);
  const [activeChatId, setActiveChatId] = useState("rani");
  const [composer, setComposer] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "groups">("all");
  const [toast, setToast] = useState<ToastState>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupContacts, setGroupContacts] = useState<string[]>(["rani"]);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwardTargets, setForwardTargets] = useState<string[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const conversationRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];
  const activeMessages = messagesByChat[activeChatId] ?? [];

  const visibleChats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return chats.filter((chat) => {
      const matchesQuery = !normalized || `${chat.name} ${chat.preview}`.toLowerCase().includes(normalized);
      const matchesFilter = filter === "all" || (filter === "unread" ? chat.unread > 0 : chat.isGroup);
      return matchesQuery && matchesFilter;
    });
  }, [chats, filter, query]);

  const shownMessages = useMemo(() => {
    const normalized = conversationSearch.trim().toLowerCase();
    if (!normalized) return activeMessages;
    return activeMessages.filter((message) => message.text.toLowerCase().includes(normalized));
  }, [activeMessages, conversationSearch]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [activeChatId, activeMessages.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const closeMenus = () => {
      setSelectedMessageId(null);
      setNewChatOpen(false);
      setChatMenuOpen(false);
      setProfileMenuOpen(false);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  const notify = (message: string, kind: ToastKind = "success") => setToast({ message, kind });

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats((current) => current.map((chat) => (chat.id === chatId ? { ...chat, unread: 0 } : chat)));
    setConversationSearch("");
    setSearchOpen(false);
    setMobileShowChat(true);
  };

  const appendMessage = (chatId: string, message: Message) => {
    setMessagesByChat((current) => ({ ...current, [chatId]: [...(current[chatId] ?? []), message] }));
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId ? { ...chat, preview: message.text, time: message.time === "sekarang" ? "sekarang" : message.time } : chat,
      ),
    );
  };

  const sendMessage = () => {
    const text = composer.trim();
    if (!text) return;
    const sentMessage: Message = {
      id: `m-${Date.now()}`,
      text,
      from: "me",
      time: formatNow(),
      status: "read",
      replyTo: replyTo?.text,
    };
    appendMessage(activeChatId, sentMessage);
    setComposer("");
    setReplyTo(null);
    setEmojiOpen(false);
    window.setTimeout(() => {
      const response: Message = {
        id: `reply-${Date.now()}`,
        text: activeChat?.isGroup ? "Noted, teman-teman. Aku update di sini ya." : "Siap, aku cek sekarang ya ✦",
        from: "them",
        time: formatNow(),
      };
      appendMessage(activeChatId, response);
    }, 900);
  };

  const openMessageMenu = (message: Message, rect: DOMRect) => {
    setSelectedMessageId(message.id);
    setMenuPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 256),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 228)),
    });
  };

  const clearLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard?.writeText(message.text);
    } catch {
      // Clipboard permissions can be unavailable in preview environments.
    }
    setSelectedMessageId(null);
    notify("Pesan disalin ke clipboard");
  };

  const deleteMessage = (message: Message) => {
    setMessagesByChat((current) => ({
      ...current,
      [activeChatId]: (current[activeChatId] ?? []).filter((item) => item.id !== message.id),
    }));
    setSelectedMessageId(null);
    notify("Pesan dihapus dari chat", "info");
  };

  const toggleStar = (message: Message) => {
    setMessagesByChat((current) => ({
      ...current,
      [activeChatId]: (current[activeChatId] ?? []).map((item) =>
        item.id === message.id ? { ...item, starred: !item.starred } : item,
      ),
    }));
    setSelectedMessageId(null);
    notify(message.starred ? "Pesan dihapus dari pesan berbintang" : "Pesan ditandai berbintang");
  };

  const openForward = (message: Message) => {
    setForwardMessage(message);
    setForwardTargets([]);
    setSelectedMessageId(null);
  };

  const forwardSelectedMessage = () => {
    if (!forwardMessage || !forwardTargets.length) return;
    forwardTargets.forEach((chatId) => {
      appendMessage(chatId, {
        id: `forward-${Date.now()}-${chatId}`,
        text: `↗ ${forwardMessage.text}`,
        from: "me",
        time: "sekarang",
        status: "read",
      });
    });
    setForwardMessage(null);
    notify(`Pesan diteruskan ke ${forwardTargets.length} chat`);
  };

  const createGroup = () => {
    const name = groupName.trim();
    if (!name || groupContacts.length === 0) return;
    const id = `group-${Date.now()}`;
    const initials = name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
    const newGroup: Chat = {
      id,
      name,
      initials: initials || "GR",
      tone: "mint",
      preview: "Kamu membuat grup",
      time: "sekarang",
      unread: 0,
      isGroup: true,
      members: groupContacts.length + 1,
      pinned: false,
    };
    setChats((current) => [newGroup, ...current]);
    setMessagesByChat((current) => ({
      ...current,
      [id]: [{ id: `system-${id}`, text: `Kamu membuat grup “${name}”`, from: "them", time: "sekarang" }],
    }));
    setActiveChatId(id);
    setMobileShowChat(true);
    setGroupOpen(false);
    setGroupName("");
    setGroupContacts(["rani"]);
    notify(`Grup “${name}” berhasil dibuat`);
  };

  const toggleGroupContact = (contactId: string) => {
    setGroupContacts((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId],
    );
  };

  const insertEmoji = (emoji: string) => setComposer((current) => `${current}${emoji}`);

  return (
    <main className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="app-shell" aria-label="Whisp chat workspace">
        <aside className={`sidebar ${mobileShowChat ? "mobile-hidden" : ""}`}>
          <div className="sidebar-topline">
            <div className="brand-lockup">
              <div className="brand-mark"><span /></div>
              <div>
                <div className="brand-name">whisp</div>
                <div className="brand-caption">private workspace</div>
              </div>
            </div>
            <div className="sidebar-actions">
              <button className="icon-button subtle" title="Pesan baru" onClick={() => setNewChatOpen((open) => !open)}>
                <SquarePen size={18} />
              </button>
              <button className="icon-button subtle" title="Buat grup" onClick={() => setGroupOpen(true)}>
                <UsersRound size={18} />
              </button>
              <button className="icon-button subtle" title="Menu profil" onClick={(event) => { event.stopPropagation(); setProfileMenuOpen((open) => !open); }}>
                <MoreVertical size={18} />
              </button>
              {profileMenuOpen && (
                <div className="floating-menu profile-menu" onClick={(event) => event.stopPropagation()}>
                  <button onClick={() => notify("Profil lokal siap diedit", "info")}><div className="menu-icon"><Settings size={16} /></div>Pengaturan</button>
                  <button onClick={() => notify("Pesan berbintang akan hadir di sini", "info")}><div className="menu-icon"><Star size={16} /></div>Pesan berbintang</button>
                  <button onClick={() => notify("Semua chat sudah tersimpan lokal", "info")}><div className="menu-icon"><Archive size={16} /></div>Arsip</button>
                </div>
              )}
              {newChatOpen && (
                <div className="floating-menu new-chat-menu" onClick={(event) => event.stopPropagation()}>
                  <button onClick={() => { setGroupOpen(true); setNewChatOpen(false); }}><div className="menu-icon"><UsersRound size={16} /></div>Grup baru</button>
                  <button onClick={() => { notify("Pilih kontak dari daftar chat untuk memulai pesan", "info"); setNewChatOpen(false); }}><div className="menu-icon"><UserPlus size={16} /></div>Kontak baru</button>
                  <button onClick={() => { notify("Pesan tersimpan siap digunakan", "info"); setNewChatOpen(false); }}><div className="menu-icon"><Star size={16} /></div>Pesan tersimpan</button>
                </div>
              )}
            </div>
          </div>

          <div className="profile-strip">
            <div className="avatar avatar-mint large">N</div>
            <div className="profile-copy">
              <strong>Naya Maheswari</strong>
              <span><span className="online-dot" /> tersedia</span>
            </div>
            <button className="mini-status" title="Status aktif"><span /> online</button>
          </div>

          <div className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari chat atau kontak" aria-label="Cari chat" />
            {query && <button className="clear-search" onClick={() => setQuery("")}><X size={14} /></button>}
            <kbd>⌘ K</kbd>
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Filter chat">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Semua</button>
            <button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Belum dibaca {chats.filter((chat) => chat.unread > 0).length > 0 && <span>{chats.filter((chat) => chat.unread > 0).length}</span>}</button>
            <button className={filter === "groups" ? "active" : ""} onClick={() => setFilter("groups")}>Grup</button>
          </div>

          <div className="chat-list" aria-label="Daftar chat">
            {visibleChats.length ? visibleChats.map((chat) => (
              <button key={chat.id} className={`chat-row ${activeChatId === chat.id ? "selected" : ""}`} onClick={() => selectChat(chat.id)}>
                <div className={`avatar avatar-${chat.tone}`}>{chat.initials}</div>
                <div className="chat-row-copy">
                  <div className="chat-row-head">
                    <strong>{chat.name}</strong>
                    <time>{chat.time}</time>
                  </div>
                  <div className="chat-row-foot">
                    <span className="chat-preview">{chat.preview}</span>
                    <span className="chat-meta">
                      {chat.pinned && <Pin size={12} fill="currentColor" />}
                      {chat.muted && <BellOff size={12} />}
                      {chat.unread > 0 && <b>{chat.unread}</b>}
                    </span>
                  </div>
                </div>
              </button>
            )) : (
              <div className="empty-list"><Search size={18} /><span>Tidak ada chat yang cocok</span></div>
            )}
          </div>

          <div className="sidebar-footer">
            <div className="encrypted-note"><LockKeyhole size={13} /> Semua chat disimpan lokal di perangkat ini</div>
            <div className="sidebar-bottom-nav">
              <button onClick={() => notify("Notifikasi telah disenyapkan sementara", "info")}><BellOff size={15} />Senyap</button>
              <button onClick={() => notify("Bantuan Whisp dibuka", "info")}><CircleHelp size={15} />Bantuan</button>
            </div>
          </div>
        </aside>

        <section className={`chat-area ${mobileShowChat ? "" : "mobile-hidden"}`}>
          <header className="chat-header">
            <div className="chat-header-identity">
              <button className="mobile-back icon-button subtle" onClick={() => setMobileShowChat(false)} title="Kembali ke chat"><ArrowLeft size={19} /></button>
              <div className={`avatar avatar-${activeChat.tone}`}>{activeChat.initials}</div>
              <div className="chat-header-copy">
                <div className="chat-title-row"><h1>{activeChat.name}</h1>{activeChat.pinned && <Pin size={13} fill="currentColor" />}</div>
                <span>{activeChat.isGroup ? `${activeChat.members} anggota · aktif hari ini` : activeChat.online ? "online sekarang" : "terakhir dilihat baru-baru ini"}</span>
              </div>
            </div>
            <div className="chat-header-actions">
              {searchOpen && <input autoFocus className="conversation-search" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Cari di chat" />}
              <button className={`icon-button ${searchOpen ? "active" : ""}`} onClick={() => setSearchOpen((open) => !open)} title="Cari pesan"><Search size={18} /></button>
              <button className="icon-button" onClick={() => notify("Panggilan suara belum terhubung di mode lokal", "info")} title="Panggilan suara"><Phone size={18} /></button>
              <button className="icon-button" onClick={() => notify("Panggilan video belum terhubung di mode lokal", "info")} title="Panggilan video"><Video size={18} /></button>
              <button className="icon-button" onClick={() => setInfoOpen((open) => !open)} title="Info chat"><Info size={18} /></button>
              <button className="icon-button" onClick={(event) => { event.stopPropagation(); setChatMenuOpen((open) => !open); }} title="Menu chat"><MoreVertical size={18} /></button>
              {chatMenuOpen && (
                <div className="floating-menu chat-menu" onClick={(event) => event.stopPropagation()}>
                  <button onClick={() => { setChats((current) => current.map((chat) => chat.id === activeChatId ? { ...chat, muted: !chat.muted } : chat)); setChatMenuOpen(false); notify(activeChat.muted ? "Notifikasi chat dinyalakan" : "Notifikasi chat disenyapkan", "info"); }}><div className="menu-icon"><BellOff size={16} /></div>{activeChat.muted ? "Nyalakan notifikasi" : "Senyapkan notifikasi"}</button>
                  <button onClick={() => { setChats((current) => current.map((chat) => chat.id === activeChatId ? { ...chat, pinned: !chat.pinned } : chat)); setChatMenuOpen(false); notify(activeChat.pinned ? "Chat dilepas dari atas" : "Chat dipin di atas"); }}><div className="menu-icon"><Pin size={16} /></div>{activeChat.pinned ? "Lepas pin chat" : "Pin chat"}</button>
                  <button onClick={() => { setChats((current) => current.map((chat) => chat.id === activeChatId ? { ...chat, unread: 1 } : chat)); setChatMenuOpen(false); notify("Chat ditandai belum dibaca", "info"); }}><div className="menu-icon"><Check size={16} /></div>Tandai belum dibaca</button>
                  <button onClick={() => { setChatMenuOpen(false); notify("Riwayat chat tetap aman di perangkat ini", "info"); }}><div className="menu-icon"><Archive size={16} /></div>Arsipkan chat</button>
                </div>
              )}
            </div>
          </header>

          {searchOpen && conversationSearch && <div className="search-result-note"><Search size={14} /> {shownMessages.length} hasil di chat ini <button onClick={() => setConversationSearch("")}><X size={13} /></button></div>}

          <div className="conversation" ref={conversationRef}>
            <div className="encryption-banner"><ShieldCheck size={15} /><span>Pesan dan panggilan terenkripsi secara end-to-end</span><ChevronDown size={14} /></div>
            <div className="date-chip">HARI INI</div>
            <div className="message-stack">
              {shownMessages.map((message) => (
                <div key={message.id} className={`message-line ${message.from === "me" ? "outgoing" : "incoming"}`}>
                  <div
                    className={`message-bubble ${message.kind === "file" ? "file-bubble" : ""} ${message.starred ? "starred" : ""}`}
                    onContextMenu={(event) => { event.preventDefault(); openMessageMenu(message, event.currentTarget.getBoundingClientRect()); }}
                    onPointerDown={(event) => {
                      if (event.pointerType === "mouse") return;
                      longPressTimer.current = window.setTimeout(() => openMessageMenu(message, event.currentTarget.getBoundingClientRect()), 560);
                    }}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onPointerLeave={clearLongPress}
                  >
                    {message.replyTo && <div className="quoted-message"><span>Balasan kamu</span><p>{message.replyTo}</p></div>}
                    {message.kind === "file" ? <><div className="file-row"><div className="file-icon"><Mic size={16} /></div><div><strong>Voice message</strong><span>0:18 · 1.2 MB</span></div><button onClick={() => notify("Pemutar suara lokal siap", "info")}><PlayIcon /></button></div></> : <p>{message.text}</p>}
                    <div className="bubble-meta"><span>{message.time}</span>{message.starred && <Star size={11} fill="currentColor" />}{message.from === "me" && <CheckCheck size={14} className={message.status === "read" ? "read" : ""} />}</div>
                    <button className="bubble-actions" title="Aksi pesan" onClick={(event) => { event.stopPropagation(); openMessageMenu(message, event.currentTarget.parentElement?.getBoundingClientRect() ?? new DOMRect()); }}><MoreHorizontal size={14} /></button>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="composer-wrap">
            {replyTo && <div className="reply-strip"><div><span>Membalas {replyTo.from === "me" ? "pesanmu" : activeChat.name}</span><p>{replyTo.text}</p></div><button onClick={() => setReplyTo(null)}><X size={16} /></button></div>}
            {emojiOpen && <div className="emoji-panel" onClick={(event) => event.stopPropagation()}><div className="emoji-panel-title">Emoji</div><div className="emoji-grid">{["😀", "😄", "🥹", "😉", "😍", "🤍", "✨", "🔥", "👍", "🙏", "🎉", "💡", "🌿", "🫶", "😂", "🤝"].map((emoji) => <button key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div></div>}
            {attachmentOpen && <div className="attachment-panel" onClick={(event) => event.stopPropagation()}><button onClick={() => { notify("Pilih foto dari perangkat", "info"); setAttachmentOpen(false); }}><span className="attach-color image"><ImageIcon size={17} /></span><b>Foto & video</b></button><button onClick={() => { notify("Pilih dokumen dari perangkat", "info"); setAttachmentOpen(false); }}><span className="attach-color file"><FileText size={17} /></span><b>Dokumen</b></button><button onClick={() => { notify("Kontak siap dibagikan", "info"); setAttachmentOpen(false); }}><span className="attach-color contact"><UsersRound size={17} /></span><b>Kontak</b></button><button onClick={() => { notify("Lokasi akan tersedia setelah izin diberikan", "info"); setAttachmentOpen(false); }}><span className="attach-color link"><Link2 size={17} /></span><b>Lokasi / tautan</b></button></div>}
            <div className="composer-bar">
              <button className={`composer-icon ${emojiOpen ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); setEmojiOpen((open) => !open); setAttachmentOpen(false); }} title="Emoji"><Smile size={21} /></button>
              <button className={`composer-icon ${attachmentOpen ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); setAttachmentOpen((open) => !open); setEmojiOpen(false); }} title="Lampiran"><Paperclip size={20} /></button>
              <textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Tulis pesan" rows={1} aria-label="Tulis pesan" />
              <button className={`send-button ${composer.trim() ? "ready" : ""}`} onClick={composer.trim() ? sendMessage : () => notify("Tahan tombol mikrofon untuk merekam", "info")} title={composer.trim() ? "Kirim pesan" : "Rekam voice message"}>{composer.trim() ? <Send size={18} /> : <Mic size={20} />}</button>
            </div>
            <div className="composer-hint"><LockKeyhole size={12} /> Tekan Enter untuk mengirim <span>•</span> Shift + Enter untuk baris baru</div>
          </div>
        </section>

        {infoOpen && (
          <aside className="info-panel">
            <div className="info-header"><strong>Info chat</strong><button className="icon-button subtle" onClick={() => setInfoOpen(false)}><X size={18} /></button></div>
            <div className={`avatar avatar-${activeChat.tone} info-avatar`}>{activeChat.initials}</div>
            <h2>{activeChat.name}</h2>
            <p className="info-subtitle">{activeChat.isGroup ? `${activeChat.members} anggota` : "+62 812 3456 7890"}</p>
            <div className="info-actions"><button onClick={() => notify("Notifikasi chat diperbarui", "info")}><BellOff size={17} />Senyap</button><button onClick={() => notify("Chat dipin di atas", "info")}><Pin size={17} />Pin</button><button onClick={() => notify("Pencarian chat aktif", "info")}><Search size={17} />Cari</button></div>
            <div className="info-section"><span className="section-label">Tentang</span><p>{activeChat.isGroup ? "Ruang kecil untuk ide-ide yang tumbuh bersama." : "Available for a good conversation."}</p></div>
            <div className="info-section"><span className="section-label">Media, link, dan dokumen</span><button className="media-preview" onClick={() => notify("Belum ada media lain di mockup ini", "info")}><div className="media-thumb"><ImageIcon size={18} /></div><div><strong>Media & file</strong><span>0 item</span></div><ChevronDown size={16} /></button></div>
            <div className="info-section"><span className="section-label">Pengaturan chat</span><button className="info-setting" onClick={() => setSoundOn((value) => !value)}><span className="setting-icon"><BellOff size={15} /></span><div><strong>Notifikasi</strong><span>{soundOn ? "Aktif" : "Disenyapkan"}</span></div><div className={`toggle ${soundOn ? "on" : ""}`}><span /></div></button><button className="info-setting" onClick={() => notify("Wallpaper custom bisa dipilih nanti", "info")}><span className="setting-icon"><ImageIcon size={15} /></span><div><strong>Wallpaper chat</strong><span>Whisp dark grain</span></div><ChevronDown size={16} /></button></div>
            <div className="info-footer"><ShieldCheck size={14} /> Pesan terenkripsi end-to-end</div>
          </aside>
        )}
      </section>

      {selectedMessageId && (() => {
        const selectedMessage = activeMessages.find((message) => message.id === selectedMessageId);
        if (!selectedMessage) return null;
        return <div className="message-menu floating-menu" style={{ top: menuPosition.top, left: menuPosition.left }} onClick={(event) => event.stopPropagation()}>
          <button onClick={() => { setReplyTo(selectedMessage); setSelectedMessageId(null); }}><div className="menu-icon"><ArrowLeft size={16} /></div>Balas</button>
          <button onClick={() => openForward(selectedMessage)}><div className="menu-icon"><Forward size={16} /></div>Teruskan</button>
          <button onClick={() => copyMessage(selectedMessage)}><div className="menu-icon"><Copy size={16} /></div>Salin</button>
          <button onClick={() => toggleStar(selectedMessage)}><div className="menu-icon"><Star size={16} /></div>{selectedMessage.starred ? "Hapus bintang" : "Bintangi pesan"}</button>
          <button onClick={() => deleteMessage(selectedMessage)} className="danger"><div className="menu-icon"><Trash2 size={16} /></div>Hapus</button>
        </div>;
      })()}

      {forwardMessage && (
        <div className="modal-backdrop" onClick={() => setForwardMessage(null)}>
          <div className="modal forward-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><span className="eyebrow">ACTION</span><h2>Teruskan pesan</h2></div><button className="icon-button subtle" onClick={() => setForwardMessage(null)}><X size={18} /></button></div>
            <div className="forward-preview"><Forward size={15} /><span>{forwardMessage.text}</span></div>
            <p className="modal-description">Pilih chat tujuan. Pesan akan diteruskan sebagai pesan baru.</p>
            <div className="forward-list">{chats.filter((chat) => chat.id !== activeChatId).map((chat) => <button className={`forward-row ${forwardTargets.includes(chat.id) ? "picked" : ""}`} key={chat.id} onClick={() => setForwardTargets((current) => current.includes(chat.id) ? current.filter((id) => id !== chat.id) : [...current, chat.id])}><div className={`avatar avatar-${chat.tone} small`}>{chat.initials}</div><div><strong>{chat.name}</strong><span>{chat.isGroup ? `${chat.members} anggota` : "chat pribadi"}</span></div><div className="selection-check">{forwardTargets.includes(chat.id) && <Check size={15} />}</div></button>)}</div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setForwardMessage(null)}>Batal</button><button className="primary-button" disabled={!forwardTargets.length} onClick={forwardSelectedMessage}><Forward size={16} />Teruskan {forwardTargets.length ? `(${forwardTargets.length})` : ""}</button></div>
          </div>
        </div>
      )}

      {groupOpen && (
        <div className="modal-backdrop" onClick={() => setGroupOpen(false)}>
          <div className="modal group-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><span className="eyebrow">NEW SPACE</span><h2>Buat grup baru</h2></div><button className="icon-button subtle" onClick={() => setGroupOpen(false)}><X size={18} /></button></div>
            <div className="group-name-input"><div className="avatar avatar-mint group-avatar"><Group size={20} /></div><input autoFocus value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nama grup" /></div>
            <div className="modal-section-title"><span>Pilih anggota</span><small>{groupContacts.length} dipilih</small></div>
            <div className="contact-list">{contactOptions.map((contact) => <button key={contact.id} className={`contact-row ${groupContacts.includes(contact.id) ? "picked" : ""}`} onClick={() => toggleGroupContact(contact.id)}><div className={`avatar avatar-${contact.tone} small`}>{contact.initials}</div><div><strong>{contact.name}</strong><span>tersedia untuk ditambahkan</span></div><div className="selection-check">{groupContacts.includes(contact.id) && <Check size={15} />}</div></button>)}</div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setGroupOpen(false)}>Batal</button><button className="primary-button" disabled={!groupName.trim() || !groupContacts.length} onClick={createGroup}><UsersRound size={16} />Buat grup</button></div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.kind}`}><div className="toast-check">{toast.kind === "success" ? <Check size={15} /> : <Info size={15} />}</div><span>{toast.message}</span></div>}
    </main>
  );
}

function PlayIcon() {
  return <span className="play-icon">▶</span>;
}
