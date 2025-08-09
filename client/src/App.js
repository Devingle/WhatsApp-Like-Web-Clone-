/***********************************************************
 * Chat UI (React + Material UI + Socket.io)
 * --------------------------------------------------------
 * This is the frontend for our WhatsApp-like chat system.
 * It works with the backend we documented earlier.
 *
 * Key technologies:
 *  - React hooks (useState, useEffect, useMemo, useCallback, useRef)
 *  - Material UI (MUI) for UI components and theming
 *  - socket.io-client for real-time updates
 *  - REST API (fetch) to talk to backend
 ***********************************************************/

// React Imports
import React, {
  useState, // to manage component state
  useEffect, // to run side effects (fetch data, sockets)
  useRef, // to reference DOM nodes (file input, scroll)
  useMemo, // memoize values to prevent unnecessary calculations
  useCallback, // memoize function references
} from "react";

// Connect to backend WebSocket server
import { io } from "socket.io-client";

// Material UI component imports
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

// Material UI Icon imports
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

// Where our backend server is running
const API_BASE_URL = "http://localhost:3000";

/*----------------------------------------------------------
  Utility Functions
----------------------------------------------------------*/

// Get initials for user avatar (e.g., "John Doe" -> "JD")
const getInitials = (name, waId) =>
  name
    ? name
        .split(" ")
        .map((w) => w[0]) // Take first letter of each word
        .join("")
        .slice(0, 2) // Use at most 2 letters
        .toUpperCase()
    : waId
    ? waId.slice(-2).toUpperCase() // fallback: last 2 chars of waId
    : "NA";

// Generate a color based on a string so each avatar is unique
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

// Show either time (if today), "Yesterday", or date for sidebar
const formatSidebarDateOrTime = (ts) => {
  if (!ts) return "";
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (date.toDateString() === today.toDateString()) {
    // Show only time if today
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString(); // Else show date
};

// Show only time in HH:MM AM/PM format
const formatTimeOnly = (ts) => {
  if (!ts) return "";
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/*----------------------------------------------------------
  Custom Components
----------------------------------------------------------*/

// Message status ticks (sent/delivered/read)
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

// User avatar with initials and background color
const UserAvatar = ({ name, waId }) => (
  <Avatar sx={{ bgcolor: stringToColor(waId), userSelect: "none" }}>
    {getInitials(name, waId)}
  </Avatar>
);

/**
 * ChatItem — single contact in sidebar list
 * Shows: avatar, name, time, last message, unread badge, menu
 */
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
        }}
        onClick={onSelect}
      >
        {/* Avatar + unread */}
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

        {/* Name + last message */}
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

        {/* Unread counter */}
        {!!unread && (
          <Badge badgeContent={unread} color="primary" sx={{ ml: 1 }} />
        )}

        {/* Menu button */}
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

      {/* Dropdown menu for delete */}
      <Menu
        anchorEl={menuAnchor}
        open={open}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
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

/**
 * Message — renders a single chat bubble
 * Includes text, images, audio, files
 */
function Message({ msg, theme, onDelete, selected, onSelect }) {
  const isOwn = msg.from === "me"; // whether message is mine or from other person
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
    >
      <Paper
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
        }}
      >
        {/* Show correct content type */}
        {msg.type === "image" && msg.fileUrl && (
          <img
            src={msg.fileUrl}
            alt="media"
            style={{ maxWidth: 200, borderRadius: 6, marginBottom: 6 }}
          />
        )}
        {msg.type === "audio" && msg.fileUrl && (
          <audio src={msg.fileUrl} controls style={{ width: "100%" }} />
        )}
        {msg.type === "file" && msg.fileUrl && (
          <Box sx={{ p: 1, bgcolor: "#eee", borderRadius: 1 }}>
            <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
              <strong>{msg.fileName || "Download file"}</strong>
            </a>
          </Box>
        )}
        {(!msg.type || msg.type === "text") && (
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{msg.text}</Typography>
        )}

        {/* Footer: time, status ticks, delete button */}
        <Box
          sx={{
            textAlign: "right",
            fontSize: 10,
            color: "text.secondary",
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

/**
 * MessageListWithDates — renders messages grouped by date
 */
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

    // Compute label: "Today", "Yesterday", or date
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

/*----------------------------------------------------------
  Main Component — App
----------------------------------------------------------*/

export default function App() {
  /**********************
   * STATE HOOKS
   **********************/
  const [users, setUsers] = useState([]); // list of contacts
  const [messages, setMessages] = useState([]); // all messages in current session
  const [selectedUser, setSelectedUser] = useState(null); // currently open chat
  const [sendingText, setSendingText] = useState(""); // message from input
  const [lastSeenMap, setLastSeenMap] = useState({}); // when each chat was last viewed
  const [errorMsg, setErrorMsg] = useState(""); // snackbar error message
  const [typingUser, setTypingUser] = useState(""); // "Typing..." indicator
  const [searchTerm, setSearchTerm] = useState(""); // filter chats
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false); // modal for starting new chat
  const [newUserInput, setNewUserInput] = useState(""); // input in modal
  const [darkMode, setDarkMode] = useState(false); // dark/light theme
  const [premiumAlertOpen, setPremiumAlertOpen] = useState(false); // premium feature notice
  const [selectedMsgId, setSelectedMsgId] = useState(null); // message selected for delete

  /**********************
   * REFS
   **********************/
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser); // for socket callbacks
  const isMobile = useMediaQuery("(max-width:600px)"); // adjust layout

  // Keep ref in sync
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  /**********************
   * THEME
   **********************/
  const theme = useMemo(
    () =>
      createTheme({
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
      }),
    [darkMode]
  );

  /**********************
   * HELPERS
   **********************/
  const filterUniqueMessages = useCallback((msgs) => {
    const existingIds = new Set();
    return msgs.filter((m) => {
      if (!m.message_id) return true;
      if (existingIds.has(m.message_id)) return false;
      existingIds.add(m.message_id);
      return true;
    });
  }, []);

  /**********************
   * DATA FETCH — USERS
   **********************/
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

  /**********************
   * DATA FETCH — MESSAGES
   **********************/
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

  // Auto-scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser]);

  /**********************
   * SOCKET.IO — real-time updates
   **********************/
  useEffect(() => {
    const socket = io(API_BASE_URL, { transports: ["websocket"] });

    socket.on("message_status_updated", (updatedMsg) => {
      setMessages((old) =>
        old.map((msg) =>
          msg.message_id === updatedMsg.message_id
            ? { ...msg, status: updatedMsg.status }
            : msg
        )
      );
    });

    socket.on("message_deleted", (deletedId) => {
      setMessages((old) => old.filter((m) => m.message_id !== deletedId));
    });

    socket.on("new_message", (msg) => {
      setMessages((old) => {
        const ids = new Set(old.map((m) => m.message_id));
        if (ids.has(msg.message_id)) return old;
        if (msg.waId === selectedUserRef.current) {
          setLastSeenMap((old) => ({
            ...old,
            [selectedUserRef.current]: Date.now(),
          }));
          return [...old, msg];
        }
        return old;
      });

      // Update user list last message
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

  /* Message delete function */
  function deleteMessage(messageId) {
    fetch(`${API_BASE_URL}/api/messages/${messageId}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Delete failed");
        setSelectedMsgId(null);
        setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
      })
      .catch((e) => setErrorMsg(e.toString()));
  }

  /* Count unread messages for each chat */
  const getUnreadCount = (waId) => {
    const lastSeen = lastSeenMap[waId] || 0;
    return messages.filter(
      (m) => m.waId === waId && m.from !== "me" && m.timestamp > lastSeen
    ).length;
  };

  /* Merge users list & messages list to show latest info in sidebar */
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
        if ("lastMessageType" in u) {
          if (u.lastMessageText) lastMsgPreview = u.lastMessageText;
          else if (u.lastMessageType === "image") lastMsgPreview = "📷 Photo";
          else if (u.lastMessageType === "audio") lastMsgPreview = "🎵 Audio";
          else if (u.lastMessageType === "file")
            lastMsgPreview = `📄 ${u.lastMessageFileName || "File"}`;
          lastMsgTimestamp = u.lastMessageTimestamp;
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
          `${u.name} ${u.waId}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
  }, [users, messages, searchTerm]);

  // Messages for selected user
  const currentMessages = useMemo(
    () =>
      messages
        .filter((m) => m.waId === selectedUser)
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages, selectedUser]
  );

  const lastMsgSelected = currentMessages[currentMessages.length - 1] || null;

  /* Send message: Supports text & extra data (file) */
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
      .then((res) => res.json())
      .then((saved) =>
        setMessages((old) =>
          filterUniqueMessages(
            old.map((m) => (m.message_id === tempId ? saved : m))
          )
        )
      )
      .catch((e) => setErrorMsg(e.toString()));
  }

  /* Handle file upload */
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

  /* Manually start chat */
  function addNewChat() {
    const id = newUserInput.trim();
    if (!id) return;
    setUsers((old) =>
      old.find((u) => u.waId === id)
        ? old
        : [
            { waId: id, name: id, lastMessage: "", lastMessageTimestamp: 0 },
            ...old,
          ]
    );
    setSelectedUser(id);
    setNewUserInput("");
    setNewUserDialogOpen(false);
  }

  /**********************
   * UI LAYOUT
   **********************/
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* resets CSS for Material UI theme */}
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          fontFamily: "'Segoe UI', Tahoma, Verdana",
        }}
      >
        {/* Sidebar container */}
        <Box
          sx={{
            width: isMobile ? "100%" : 320, // Full width on mobile, fixed on desktop
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top AppBar with title and action icons */}
          <AppBar position="static" sx={{ bgcolor: "primary.main" }}>
            <Toolbar>
              {/* App title text */}
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                Chat
              </Typography>
              {/* Dark mode toggle button with tooltip */}
              <Tooltip
                title={
                  darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
                }
              >
                <IconButton
                  color="inherit"
                  size="large"
                  onClick={() => setDarkMode((v) => !v)}
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
              {/* Button to open new chat dialog */}
              <Tooltip title="New Chat">
                <IconButton
                  color="inherit"
                  size="large"
                  onClick={() => setNewUserDialogOpen(true)}
                  aria-label="Start new chat"
                >
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Toolbar>
          </AppBar>

          {/* Search input in sidebar */}
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
              aria-label="Search chats"
            />
          </Box>

          <Divider />

          {/* List of chats/contacts */}
          <List sx={{ flexGrow: 1, overflowY: "auto" }} aria-label="Chat list">
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

        {/* Chat panel container */}
        <Box
          sx={{
            flexGrow: 1,
            display: isMobile && !selectedUser ? "none" : "flex", // Hide on mobile if no chat selected
            flexDirection: "column",
            bgcolor: "background.default",
          }}
          onClick={() => setSelectedMsgId(null)} // Clicking outside message deselects it
          aria-live="polite"
        >
          {/* Chat header with back button and name */}
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
                aria-label="Back to chats"
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
              aria-label="Current chat name"
            >
              {selectedUser
                ? allContacts.find((c) => c.waId === selectedUser)?.name ||
                  selectedUser
                : "Select a chat"}
            </Typography>

            {/* Call buttons (disabled - premium) with tooltips */}
            <Tooltip title="Voice Call (Premium)">
              <IconButton
                disabled={!selectedUser}
                color="inherit"
                onClick={() => setPremiumAlertOpen(true)}
                aria-label="Voice call premium"
              >
                <CallIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Video Call (Premium)">
              <IconButton
                disabled={!selectedUser}
                color="inherit"
                onClick={() => setPremiumAlertOpen(true)}
                aria-label="Video call premium"
              >
                <VideocamIcon />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Creator credit */}
          <Box
            sx={{
              py: 1,
              textAlign: "center",
              userSelect: "none",
              color: darkMode
                ? "rgba(129,169,219,0.7)"
                : "rgba(23,162,184,0.7)",
              fontSize: 12,
            }}
          >
            Created by <strong>Devingle (Amit Ghanata)</strong>
          </Box>

          {/* Messages container - scrollable list */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: "auto",
              px: 2,
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()} // Prevent deselect on message click
            aria-label="Messages"
          >
            {!selectedUser ? (
              // Prompt to choose a chat if none selected
              <Typography
                sx={{ mt: 15, textAlign: "center", color: "text.secondary" }}
              >
                Select a chat to start messaging
              </Typography>
            ) : currentMessages.length === 0 ? (
              lastMsgSelected ? (
                // Show last message preview if chat is empty
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
                // Show no messages text if no chat messages exist
                <Typography
                  sx={{ mt: 20, textAlign: "center", color: "text.secondary" }}
                >
                  No messages
                </Typography>
              )
            ) : (
              // Render list of messages grouped by date
              <MessageListWithDates
                messages={currentMessages}
                theme={theme}
                onDelete={deleteMessage}
                selectedMsgId={selectedMsgId}
                setSelectedMsgId={setSelectedMsgId}
              />
            )}

            {/* Invisible div to scroll to bottom */}
            <div ref={messagesEndRef} />

            {/* Typing indicator */}
            {typingUser && (
              <Typography
                sx={{ pl: 1, fontStyle: "italic", color: "text.secondary" }}
                aria-live="polite"
                aria-atomic="true"
              >
                {typingUser}
              </Typography>
            )}
          </Box>

          {/* Message input area */}
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
              onClick={(e) => e.stopPropagation()} // Prevent deselect on input click
            >
              {/* Hidden file input triggered by attach button */}
              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*,audio/*,.zip,.rar,.pdf,.doc,.docx,.txt"
                onChange={handleFile}
                aria-label="Attach file"
              />
              {/* Attach file button */}
              <Tooltip title="Attach file or media">
                <IconButton
                  color="primary"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach file or media"
                >
                  <AttachFileIcon />
                </IconButton>
              </Tooltip>
              {/* Text field for typing message */}
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
                aria-label="Type your message"
              />
              {/* Voice message button (premium) */}
              <Tooltip title="Record voice message (Premium)">
                <IconButton
                  color="primary"
                  onClick={() => setPremiumAlertOpen(true)}
                  aria-label="Voice message premium"
                >
                  <KeyboardVoiceIcon />
                </IconButton>
              </Tooltip>
              {/* Send message button */}
              <Tooltip title="Send message">
                <IconButton
                  disabled={!sendingText.trim()}
                  color="primary"
                  onClick={() => sendMessage()}
                  aria-label="Send message"
                >
                  <SendIcon />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Dialog to start a new chat */}
          <Dialog
            open={newUserDialogOpen}
            onClose={() => setNewUserDialogOpen(false)}
            aria-labelledby="start-new-chat-dialog"
          >
            <DialogTitle id="start-new-chat-dialog">Start New Chat</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                label="WhatsApp ID"
                variant="outlined"
                placeholder="Enter WhatsApp ID"
                value={newUserInput}
                onChange={(e) => setNewUserInput(e.target.value)}
                aria-label="Enter WhatsApp ID"
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
                aria-disabled={!newUserInput.trim()}
              >
                Start Chat
              </Button>
            </DialogActions>
          </Dialog>

          {/* Snackbar popup for premium feature alert */}
          <Snackbar
            open={premiumAlertOpen}
            autoHideDuration={2500}
            onClose={() => setPremiumAlertOpen(false)}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              onClose={() => setPremiumAlertOpen(false)}
              severity="info"
              sx={{ width: "100%" }}
            >
              Please buy premium version to use this feature.
            </Alert>
          </Snackbar>

          {/* Snackbar popup for error messages */}
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
              sx={{ width: "100%" }}
            >
              {errorMsg}
            </Alert>
          </Snackbar>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
