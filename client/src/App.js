import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  CssBaseline,
  Divider,
  Tooltip,
  Button,
  Paper,
  InputAdornment,
  TextField,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  useMediaQuery,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Add as AddIcon,
  AttachFile as AttachFileIcon,
  Send as SendIcon,
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  KeyboardVoice as KeyboardVoiceIcon,
  Call as CallIcon,
  Videocam as VideocamIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

const API_BASE_URL = "http://localhost:3000";

// Utility functions
const getInitials = (name, waId) =>
  name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : waId
    ? waId.slice(-2).toUpperCase()
    : "NA";

const stringToColor = (str = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return (
    "#" +
    [0, 8, 16]
      .map((i) => ((hash >> i) & 0xff).toString(16).padStart(2, "0"))
      .join("")
  );
};

const formatSidebarDateOrTime = (ts) => {
  if (!ts) return "";
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString();
};
const formatTimeOnly = (ts) => {
  if (!ts) return "";
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const StatusTick = ({ status }) => {
  const map = {
    sent: { tick: "✓", color: "gray" },
    delivered: { tick: "✓✓", color: "#2196f3" },
    read: { tick: "✓✓", color: "#4caf50" },
  };
  if (!status || !map[status]) return null;
  return (
    <Typography
      component="span"
      variant="caption"
      sx={{ ml: 0.5, color: map[status].color, fontWeight: "bold" }}
    >
      {map[status].tick}
    </Typography>
  );
};

const UserAvatar = ({ name, waId }) => (
  <Avatar sx={{ bgcolor: stringToColor(waId), userSelect: "none" }}>
    {getInitials(name, waId)}
  </Avatar>
);

function ChatItem({
  user,
  lastMessage,
  selected,
  unread,
  onSelect,
  onDelete,
  theme,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const open = Boolean(menuAnchor);
  const accentColor = theme.palette.mode === "dark" ? "#81a9db" : "#222";
  return (
    <>
      <ListItem
        button
        selected={selected}
        sx={{
          px: 2,
          bgcolor: selected
            ? theme.palette.mode === "dark"
              ? "#14304f"
              : "rgba(0,0,0,0.08)"
            : "transparent",
          py: 1,
          display: "flex",
          alignItems: "center",
          wordBreak: "break-word",
        }}
        onClick={onSelect}
      >
        <ListItemAvatar>
          <Badge
            overlap="circular"
            color="success"
            invisible={!unread}
            variant="dot"
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <UserAvatar name={user.name} waId={user.waId} />
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography
                noWrap
                sx={{ fontWeight: "bold", color: accentColor }}
              >
                {user.name || user.waId}
              </Typography>
              <Typography noWrap sx={{ color: "text.secondary", fontSize: 13 }}>
                {formatSidebarDateOrTime(user.lastMessageTimestamp)}
              </Typography>
            </Box>
          }
          secondary={
            <Typography noWrap sx={{ color: "text.secondary" }}>
              {lastMessage || "No messages"}
            </Typography>
          }
          sx={{ pl: 1 }}
        />
        {!!unread && (
          <Badge badgeContent={unread} color="primary" sx={{ ml: 1 }} />
        )}
        <Tooltip title="Options">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget);
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </ListItem>
      <Menu
        anchorEl={menuAnchor}
        open={open}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { minWidth: 140 } }}
      >
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            onDelete();
            setMenuAnchor(null);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}

function Message({ msg, theme, onDelete, selected, onSelect }) {
  const isOwn = msg.from === "me";
  const timeStr = formatTimeOnly(msg.timestamp);
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isOwn ? "flex-end" : "flex-start",
        mb: 1,
        px: 1,
      }}
      onClick={onSelect}
      tabIndex={0}
      style={{ cursor: isOwn ? "pointer" : "default" }}
    >
      <Paper
        elevation={1}
        sx={{
          bgcolor: isOwn
            ? theme.palette.mode === "dark"
              ? "#224d36"
              : "#dcf6dc"
            : "background.paper",
          p: 1,
          borderRadius: 2,
          maxWidth: "70%",
          wordBreak: "break-word",
          boxShadow: "0 0 1px rgb(0 0 0 / 0.1)",
          position: "relative",
        }}
      >
        {msg.type === "image" && msg.fileUrl && (
          <img
            src={msg.fileUrl}
            alt="media"
            style={{ maxWidth: 200, borderRadius: 6, marginBottom: 6 }}
          />
        )}
        {msg.type === "audio" && msg.fileUrl && (
          <audio
            src={msg.fileUrl}
            controls
            style={{ width: "100%", marginBottom: 6 }}
          />
        )}
        {msg.type === "file" && msg.fileUrl && (
          <Box sx={{ p: 1, bgcolor: "#eee", borderRadius: 1, mb: 1 }}>
            <a
              href={msg.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: theme.palette.primary.main,
                wordBreak: "break-all",
              }}
            >
              <strong>{msg.fileName || "Download file"}</strong>
            </a>
          </Box>
        )}
        {(!msg.type || msg.type === "text") && (
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{msg.text}</Typography>
        )}
        <Box
          sx={{
            textAlign: "right",
            fontSize: 10,
            color: "text.secondary",
            mt: 0.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 1,
          }}
        >
          <Typography component="span">{timeStr}</Typography>
          {isOwn && <StatusTick status={msg.status} />}
          {isOwn && selected && (
            <Tooltip title="Delete this message">
              <IconButton
                size="small"
                sx={{ ml: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(msg.message_id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

function MessageListWithDates({
  messages,
  theme,
  onDelete,
  selectedMsgId,
  setSelectedMsgId,
}) {
  let lastDate = "";
  return messages.map((msg) => {
    const msgDate = new Date(msg.timestamp);
    const msgDateStr = msgDate.toDateString();
    const showDate = lastDate !== msgDateStr;
    lastDate = msgDateStr;

    let dateLabel = msgDateStr;
    const todayStr = new Date().toDateString();
    const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
    if (msgDateStr === todayStr) dateLabel = "Today";
    else if (msgDateStr === yesterdayStr) dateLabel = "Yesterday";

    return (
      <React.Fragment key={msg.message_id}>
        {showDate && (
          <Box
            sx={{
              textAlign: "center",
              my: 2,
              color: theme.palette.text.secondary,
              fontSize: 13,
              fontWeight: "bold",
            }}
          >
            {dateLabel}
          </Box>
        )}
        <Message
          msg={msg}
          theme={theme}
          onDelete={onDelete}
          selected={selectedMsgId === msg.message_id}
          onSelect={() =>
            setSelectedMsgId(
              selectedMsgId === msg.message_id ? null : msg.message_id
            )
          }
        />
      </React.Fragment>
    );
  });
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sendingText, setSendingText] = useState("");
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [newUserInput, setNewUserInput] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [premiumAlertOpen, setPremiumAlertOpen] = useState(false);
  const [selectedMsgId, setSelectedMsgId] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);
  const isMobile = useMediaQuery("(max-width:600px)");

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const theme = useMemo(() => {
    return createTheme({
      palette: {
        mode: darkMode ? "dark" : "light",
        ...(darkMode
          ? {
              primary: { main: "#29a9db" },
              background: { default: "#121212", paper: "#222" },
              text: { primary: "#eee", secondary: "#aaa" },
            }
          : {
              primary: { main: "#1976d2" },
              background: { default: "#fafafa", paper: "#fff" },
              text: { primary: "#222", secondary: "#555" },
            }),
      },
    });
  }, [darkMode]);

  const filterUniqueMessages = useCallback((msgs) => {
    const existingIds = new Set();
    return msgs.filter((m) => {
      if (!m.message_id) return true;
      if (existingIds.has(m.message_id)) return false;
      existingIds.add(m.message_id);
      return true;
    });
  }, []);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`);
        if (!res.ok) throw new Error("Failed to fetch users");
        const data = await res.json();
        setUsers(data);
        if (!selectedUser && data.length)
          setSelectedUser(data[0].waId || data[0].wa_id);
      } catch (e) {
        setErrorMsg(e.message);
      }
    }
    fetchUsers();
  }, []);

  // Always refetch messages from backend on chat switch
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }
    async function fetchMessages() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/messages/${selectedUser}`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        setMessages(filterUniqueMessages(data));
        setLastSeenMap((old) => ({ ...old, [selectedUser]: Date.now() }));
      } catch (e) {
        setErrorMsg(e.message);
      }
    }
    fetchMessages();
  }, [selectedUser, filterUniqueMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser]);

  useEffect(() => {
    const socket = io(API_BASE_URL, { transports: ["websocket"] });

    socket.on("message_status_updated", (updatedMsg) => {
      setMessages((oldMessages) =>
        oldMessages.map((msg) =>
          msg.message_id === updatedMsg.message_id
            ? { ...msg, status: updatedMsg.status }
            : msg
        )
      );
    });

    socket.on("message_deleted", (deletedMessageId) => {
      setMessages((old) =>
        old.filter((m) => m.message_id !== deletedMessageId)
      );
    });

    socket.on("new_message", (msg) => {
      setMessages((oldMessages) => {
        const ids = new Set(oldMessages.map((m) => m.message_id));
        if (ids.has(msg.message_id)) return oldMessages;
        if (msg.waId === selectedUserRef.current) {
          setLastSeenMap((old) => ({
            ...old,
            [selectedUserRef.current]: Date.now(),
          }));
          return [...oldMessages, msg];
        }
        return oldMessages;
      });

      setUsers((oldUsers) => {
        const idx = oldUsers.findIndex((u) => u.waId === msg.waId);
        if (idx !== -1) {
          const updatedUser = {
            ...oldUsers[idx],
            lastMessage: msg.text || "",
            lastMessageTimestamp: msg.timestamp,
            name: oldUsers[idx].name || msg.contact_name || "",
          };
          return [
            ...oldUsers.slice(0, idx),
            updatedUser,
            ...oldUsers.slice(idx + 1),
          ];
        }
        return [
          {
            waId: msg.waId,
            name: msg.contact_name || "",
            lastMessage: msg.text || "",
            lastMessageTimestamp: msg.timestamp,
          },
          ...oldUsers,
        ];
      });
    });

    socket.on("typing", (waId) => {
      if (waId === selectedUserRef.current) {
        setTypingUser("Typing...");
        setTimeout(() => setTypingUser(""), 3000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  function deleteMessage(messageId) {
    fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
      method: "DELETE",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Delete failed");
        setSelectedMsgId(null);
        setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
      })
      .catch((e) => setErrorMsg(e.toString()));
  }

  const getUnreadCount = (waId) => {
    const lastSeen = lastSeenMap[waId] || 0;
    return messages.filter(
      (m) => m.waId === waId && m.from !== "me" && m.timestamp > lastSeen
    ).length;
  };

  // 🚀 SIDEBAR: Always uses backend-provided fields, fallback to local if needed
  const allContacts = useMemo(() => {
    const ids = new Set([
      ...users.map((u) => u.waId || u.wa_id),
      ...messages.map((m) => m.waId),
    ]);
    return Array.from(ids)
      .map((waId) => {
        const u = users.find((user) => (user.waId || user.wa_id) === waId) || {
          waId,
          name: waId,
        };

        let lastMsgPreview = "";
        let lastMsgTimestamp = u.lastMessageTimestamp || 0;

        if (
          "lastMessageType" in u ||
          "lastMessageText" in u ||
          "lastMessageFileName" in u
        ) {
          if (u.lastMessageText && u.lastMessageText.trim() !== "")
            lastMsgPreview = u.lastMessageText;
          else if (u.lastMessageType === "image") lastMsgPreview = "📷 Photo";
          else if (u.lastMessageType === "audio") lastMsgPreview = "🎵 Audio";
          else if (u.lastMessageType === "file")
            lastMsgPreview = `📄 ${u.lastMessageFileName || "File"}`;
          else lastMsgPreview = "";
          if (typeof u.lastMessageTimestamp === "number")
            lastMsgTimestamp = u.lastMessageTimestamp;
        } else {
          const lastMsg = messages
            .filter((m) => m.waId === waId)
            .reduce((a, b) => (a.timestamp > b.timestamp ? a : b), {
              timestamp: 0,
            });
          if (lastMsg.timestamp) {
            if (lastMsg.text && lastMsg.text.trim() !== "")
              lastMsgPreview = lastMsg.text;
            else if (lastMsg.type === "image") lastMsgPreview = "📷 Photo";
            else if (lastMsg.type === "audio") lastMsgPreview = "🎵 Audio";
            else if (lastMsg.type === "file")
              lastMsgPreview = `📄 ${lastMsg.fileName || "File"}`;
            lastMsgTimestamp = lastMsg.timestamp;
          }
        }

        return {
          ...u,
          waId,
          lastMessage: lastMsgPreview,
          lastMessageTimestamp: lastMsgTimestamp,
        };
      })
      .filter(
        (u) =>
          !searchTerm ||
          `${u.name ?? ""} ${u.waId ?? ""}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
  }, [users, messages, searchTerm]);

  const currentMessages = useMemo(
    () =>
      messages
        .filter((m) => m.waId === selectedUser)
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, selectedUser]
  );

  const lastMsgSelected = currentMessages.length
    ? currentMessages[currentMessages.length - 1]
    : null;

  function sendMessage(extra = null) {
    if ((!sendingText.trim() && !extra) || !selectedUser) return;
    const tempId = `temp-${Date.now()}`;
    const payload = {
      waId: selectedUser,
      from: "me",
      text: sendingText.trim() || "",
      contact_name:
        allContacts.find((c) => c.waId === selectedUser)?.name || "",
      ...extra,
    };
    const tempMsg = {
      ...payload,
      message_id: tempId,
      timestamp: Date.now(),
      status: "sent",
      createdAt: new Date(),
    };
    setMessages((old) => filterUniqueMessages([...old, tempMsg]));
    setSendingText("");
    setSelectedMsgId(null);
    fetch(`${API_BASE_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to send message");
        return res.json();
      })
      .then((saved) =>
        setMessages((old) =>
          filterUniqueMessages(
            old.map((m) => (m.message_id === tempId ? saved : m))
          )
        )
      )
      .catch((e) => setErrorMsg(e.toString()));
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
      ? "audio"
      : "file";
    const reader = new FileReader();
    reader.onload = (ev) =>
      sendMessage({ type, fileUrl: ev.target.result, fileName: file.name });
    reader.readAsDataURL(file);
    e.target.value = null;
  }

  function addNewChat() {
    const id = newUserInput.trim();
    if (!id) return;
    setUsers((old) => {
      if (old.find((u) => u.waId === id)) return old;
      return [
        { waId: id, name: id, lastMessage: "", lastMessageTimestamp: 0 },
        ...old,
      ];
    });

    setSelectedUser(id);
    setNewUserInput("");
    setNewUserDialogOpen(false);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          fontFamily: "'Segoe UI', Tahoma, Verdana",
        }}
      >
        {/* Sidebar */}
        <Box
          sx={{
            width: isMobile ? "100%" : 320,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AppBar position="static" sx={{ bgcolor: "primary.main" }}>
            <Toolbar>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Chat
              </Typography>
              <Tooltip
                title={
                  darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
                }
              >
                <IconButton
                  color="inherit"
                  size="large"
                  onClick={() => setDarkMode((v) => !v)}
                >
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="New Chat">
                <IconButton
                  color="inherit"
                  size="large"
                  onClick={() => setNewUserDialogOpen(true)}
                >
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Toolbar>
          </AppBar>
          <Box sx={{ px: 1, py: 0.5 }}>
            <TextField
              fullWidth
              placeholder="Search or start chat"
              size="small"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="disabled" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Divider />
          <List sx={{ flexGrow: 1, overflowY: "auto" }}>
            {allContacts.map((user) => (
              <ChatItem
                key={user.waId}
                user={user}
                selected={user.waId === selectedUser}
                onSelect={() => setSelectedUser(user.waId)}
                onDelete={() => {
                  if (window.confirm("Delete chat?")) {
                    fetch(`${API_BASE_URL}/api/users/${user.waId}`, {
                      method: "DELETE",
                    })
                      .then((res) => {
                        if (!res.ok) throw new Error("Delete failed");
                        setUsers((old) =>
                          old.filter((u) => u.waId !== user.waId)
                        );
                        if (selectedUser === user.waId) {
                          setSelectedUser(null);
                          setMessages([]);
                        }
                      })
                      .catch((e) => setErrorMsg(e.toString()));
                  }
                }}
                lastMessage={user.lastMessage}
                unread={getUnreadCount(user.waId)}
                theme={theme}
              />
            ))}
          </List>
        </Box>
        {/* Chat Panel */}
        <Box
          sx={{
            flexGrow: 1,
            display: isMobile && !selectedUser ? "none" : "flex",
            flexDirection: "column",
            bgcolor: "background.default",
          }}
          onClick={() => setSelectedMsgId(null)}
        >
          <Box
            sx={{
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              px: 2,
              py: 1,
              gap: 1,
            }}
          >
            {isMobile && (
              <IconButton
                onClick={() => setSelectedUser(null)}
                size="large"
                aria-label="Back"
              >
                <CloseIcon />
              </IconButton>
            )}
            <Typography
              sx={{
                flexGrow: 1,
                fontWeight: "bold",
                fontSize: 20,
                userSelect: "none",
                color: theme.palette.text.primary,
              }}
            >
              {selectedUser
                ? allContacts.find((c) => c.waId === selectedUser)?.name ||
                  selectedUser
                : "Select a chat"}
            </Typography>
            <Tooltip title="Voice Call (Premium)">
              <IconButton
                disabled={!selectedUser}
                color="inherit"
                onClick={() => setPremiumAlertOpen(true)}
              >
                <CallIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Video Call (Premium)">
              <IconButton
                disabled={!selectedUser}
                color="inherit"
                onClick={() => setPremiumAlertOpen(true)}
              >
                <VideocamIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Box
            sx={{
              py: 1,
              textAlign: "center",
              userSelect: "none",
              color: darkMode
                ? "rgba(129,169,219,0.7)"
                : "rgba(23,162,184,0.7)",
            }}
          >
            Created by <strong>Devingle (Amit Ghanata)</strong>
          </Box>
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              px: 2,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!selectedUser ? (
              <Typography
                sx={{ mt: 15, textAlign: "center", color: "text.secondary" }}
              >
                Select a chat to start messaging
              </Typography>
            ) : currentMessages.length === 0 ? (
              lastMsgSelected ? (
                <Paper
                  sx={{
                    mx: "auto",
                    mt: 20,
                    maxWidth: 400,
                    p: 3,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    color: theme.palette.primary.main,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Last message:
                  </Typography>
                  <Typography>
                    {lastMsgSelected.text && lastMsgSelected.text.trim() !== ""
                      ? lastMsgSelected.text.length > 120
                        ? lastMsgSelected.text.slice(0, 120) + "…"
                        : lastMsgSelected.text
                      : lastMsgSelected.type === "image"
                      ? "📷 Photo"
                      : lastMsgSelected.type === "audio"
                      ? "🎵 Audio"
                      : lastMsgSelected.type === "file"
                      ? `📄 ${lastMsgSelected.fileName || "File"}`
                      : ""}
                  </Typography>
                </Paper>
              ) : (
                <Typography
                  sx={{ mt: 20, textAlign: "center", color: "text.secondary" }}
                >
                  No messages
                </Typography>
              )
            ) : (
              <MessageListWithDates
                messages={currentMessages}
                theme={theme}
                onDelete={deleteMessage}
                selectedMsgId={selectedMsgId}
                setSelectedMsgId={setSelectedMsgId}
              />
            )}
            <div ref={messagesEndRef} />
            {typingUser && (
              <Typography
                sx={{ pl: 1, fontStyle: "italic", color: "text.secondary" }}
              >
                {typingUser}
              </Typography>
            )}
          </Box>
          {selectedUser && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 1,
                borderTop: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
              onClick={(e) => e.stopPropagation()} // Prevents deselection when using input
            >
              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*,audio/*,.zip,.rar,.pdf,.doc,.docx,.txt"
                onChange={handleFile}
              />
              <Tooltip title="Attach file or media">
                <IconButton
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <AttachFileIcon />
                </IconButton>
              </Tooltip>
              <TextField
                multiline
                variant="outlined"
                placeholder="Type a message"
                fullWidth
                value={sendingText}
                onChange={(e) => setSendingText(e.target.value)}
                maxRows={6}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Tooltip title="Record voice message (Premium)">
                <IconButton
                  color="primary"
                  onClick={() => setPremiumAlertOpen(true)}
                >
                  <KeyboardVoiceIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Send message">
                <IconButton
                  disabled={!sendingText.trim()}
                  color="primary"
                  onClick={() => sendMessage()}
                >
                  <SendIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}
          <Dialog
            open={newUserDialogOpen}
            onClose={() => setNewUserDialogOpen(false)}
          >
            <DialogTitle>Start New Chat</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                label="WhatsApp ID"
                variant="outlined"
                placeholder="Enter WhatsApp ID"
                value={newUserInput}
                onChange={(e) => setNewUserInput(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNewUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!newUserInput.trim()}
                variant="contained"
                onClick={addNewChat}
              >
                Start Chat
              </Button>
            </DialogActions>
          </Dialog>
          <Snackbar
            open={premiumAlertOpen}
            autoHideDuration={2500}
            onClose={() => setPremiumAlertOpen(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert onClose={() => setPremiumAlertOpen(false)} severity="info">
              Please buy premium version to use this feature.
            </Alert>
          </Snackbar>
          <Snackbar
            open={!!errorMsg}
            autoHideDuration={4000}
            onClose={() => setErrorMsg("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={() => setErrorMsg("")}
              severity="error"
              variant="filled"
            >
              {errorMsg}
            </Alert>
          </Snackbar>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
