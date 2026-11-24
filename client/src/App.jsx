import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowLeft, Check, CheckCheck, ChevronDown, CircleUserRound, FileText,
  Image, LogOut, MessageCircle, Mic, MicOff, Moon, MoreHorizontal, Paperclip,
  Phone, PhoneOff, Plus, Search, Send, Settings, Smile, Sun, UserPlus,
  Video, VideoOff, X,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from '@firebase/auth';
import api, { clearAuthToken, getAuthToken, getErrorMessage, setAuthToken } from './lib/api';
import { auth, googleProvider, isFirebaseConfigured } from './lib/firebase';
import { useAuthStore } from './store/authStore';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const RTC_CONFIG = {
  iceServers: [
    // TODO: Add TURN server for production to hide user IP addresses.
    // Options: Metered.ca, Twilio TURN, or a self-hosted coturn server.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};
const EmojiPicker = lazy(() => import('emoji-picker-react'));

function Avatar({ person, size = 'normal', online = false }) {
  const label = person?.name || person?.username || 'ChatBox';
  return (
    <span className={`avatar avatar-${size}`}>
      {person?.photoURL
        ? <img src={person.photoURL} alt="" referrerPolicy="no-referrer" />
        : <span aria-hidden="true">{label.slice(0, 1).toUpperCase()}</span>}
      {online && <i className="online-dot" aria-label="Online" />}
    </span>
  );
}

function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) return undefined;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearAuthToken();
        return;
      }
      try {
        const idToken = await firebaseUser.getIdToken();
        const { data } = await api.post('/api/auth/google', { idToken });
        if (!active) return;
        setAuthToken(data.token);
        setUser(data.user);
        navigate(data.needsUsername ? '/setup' : '/home', { replace: true });
      } catch (loginError) {
        clearAuthToken();
        if (active) setError(getErrorMessage(loginError));
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate, setUser]);

  async function handleGoogleLogin() {
    if (!auth) return setError('Google sign-in is not configured. Add the Firebase values to client/.env.');
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged exchanges the Firebase ID token and creates the app session.
    } catch (loginError) {
      setError(getErrorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-art" aria-hidden="true">
        <div className="art-glow art-glow-one" />
        <div className="art-glow art-glow-two" />
        <div className="art-note note-one">Good morning! ☀️</div>
        <div className="art-note note-two">The little things are better shared.</div>
        <div className="art-orbit"><MessageCircle size={54} strokeWidth={1.4} /></div>
      </div>
      <section className="login-card">
        <div className="brand-mark"><MessageCircle size={20} fill="currentColor" /><span>chatbox</span></div>
        <div className="login-copy">
          <span className="eyebrow">YOUR PEOPLE, CLOSER</span>
          <h1>Make room for<br /><em>good conversations.</em></h1>
          <p>A quieter corner of the internet for the people who matter most.</p>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="google-button" onClick={handleGoogleLogin} disabled={busy || !isFirebaseConfigured}>
          {busy ? <span className="spinner" /> : <GoogleMark />}
          {busy ? 'Connecting…' : 'Continue with Google'}
        </button>
        {!isFirebaseConfigured && <p className="setup-hint">Add your Firebase web app settings to <code>client/.env</code> to enable sign-in.</p>}
        <p className="login-terms">By continuing, you agree to keep this a kind place.</p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.74 6c4.52-4.18 7.1-10.34 7.1-17.71z" transform="translate(0 0)" />
      <path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.2a23.9 23.9 0 0 0 0 21.58l7.98-6.2z" transform="translate(0 0)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.74-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48z" transform="translate(0 -4)" />
    </svg>
  );
}

function SetupPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [available, setAvailable] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const candidate = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(candidate)) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/users/availability/${encodeURIComponent(candidate)}`);
        if (active) setAvailable(data.available);
      } catch {
        if (active) setAvailable(null);
      }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [username]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch('/api/auth/username', { username });
      setUser(data.user);
      navigate('/home', { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="setup-screen">
      <form className="setup-card" onSubmit={submit}>
        <Avatar person={user} size="large" />
        <span className="eyebrow">ONE LAST THING</span>
        <h1>Pick your little corner.</h1>
        <p>Your username helps friends find you. You can change it later.</p>
        <label className="input-label" htmlFor="username">Your username</label>
        <div className="username-input"><span>@</span><input id="username" value={username} onChange={(event) => { setUsername(event.target.value); setAvailable(null); }} minLength={3} maxLength={20} required /></div>
        <div className={`availability ${available === true ? 'available' : ''} ${available === false ? 'unavailable' : ''}`}>
          {available === true ? 'Looks good — it’s yours.' : available === false ? 'That username is already taken.' : '3–20 letters, numbers, or underscores'}
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button full-button" disabled={busy || available !== true}>{busy ? 'Saving…' : 'Continue to ChatBox'}</button>
      </form>
    </main>
  );
}

function AppShell() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const [booting, setBooting] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageCursor, setMessageCursor] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [section, setSection] = useState('chats');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [busy, setBusy] = useState(false);
  const theme = user?.settings?.theme || localStorage.getItem('chatbox-theme') || 'light';
  const [menuMessage, setMenuMessage] = useState(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const scrollRef = useRef(null);
  const scrollAdjustmentRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const paginationEpochRef = useRef(0);
  const typingTimer = useRef(null);
  const typingActive = useRef(false);
  const activeRef = useRef(active);
  const userRef = useRef(user);
  const endCallRef = useRef(null);
  const navigate = useNavigate();
  const userId = user?._id;
  const callStatus = call?.status;

  const endCall = useCallback((notifyPeer = true) => {
    if (notifyPeer && call?.to) socketRef.current?.emit('call_ended', { to: call.to });
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setCall(null);
    setIncomingCall(null);
    setMuted(false);
    setCameraOff(false);
  }, [call]);

  const activePerson = useMemo(() => {
    if (!active) return null;
    if (active.type === 'group') return groups.find((group) => group._id === active.id) || active;
    return conversations.find((entry) => entry.user._id === active.id)?.user || active.user || active;
  }, [active, conversations, groups]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

  const saveUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, [setUser]);

  const loadData = useCallback(async () => {
    try {
      const [chatResponse, groupResponse, statusResponse] = await Promise.all([
        api.get('/api/messages/conversations'),
        api.get('/api/groups'),
        api.get('/api/status'),
      ]);
      setConversations(chatResponse.data.conversations);
      setGroups(groupResponse.data.groups);
      setStatuses(statusResponse.data.statuses);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    let activeEffect = true;
    if (!auth) {
      clearAuthToken();
      clearUser();
      setBooting(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        clearAuthToken();
        if (activeEffect) {
          clearUser();
          setBooting(false);
        }
        return;
      }
      try {
        const idToken = await firebaseUser.getIdToken();
        const { data } = await api.post('/api/auth/google', { idToken });
        if (!activeEffect) return;
        setAuthToken(data.token);
        saveUser(data.user);
      } catch {
        clearAuthToken();
        if (activeEffect) clearUser();
      } finally {
        if (activeEffect) setBooting(false);
      }
    });
    return () => {
      activeEffect = false;
      unsubscribe();
    };
  }, [clearUser, saveUser]);

  useEffect(() => {
    if (!userId) return undefined;
    loadData();
    const socket = io(API_URL, { auth: { token: getAuthToken() } });
    socketRef.current = socket;
    socket.on('connect_error', (error) => toast.error(`Live updates unavailable: ${error.message}`));
    socket.on('receive_message', (message) => {
      const fromSelf = message.sender?._id === userId || message.sender === userId;
      const currentActive = activeRef.current;
      const selected = currentActive?.type === 'group'
        ? message.group === currentActive.id || message.group?._id === currentActive.id
        : (!message.group && (message.sender?._id === currentActive?.id || message.sender === currentActive?.id ||
          message.receiver === currentActive?.id || message.receiver?._id === currentActive?.id));
      if (selected) setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
      if (selected && !fromSelf) {
        if (message.group) api.put(`/api/messages/read/group/${message.group._id || message.group}`).catch(() => {});
        else api.put(`/api/messages/read/${message.sender?._id || message.sender}`).catch(() => {});
      }
      if (!fromSelf && !selected && userRef.current?.settings?.notifications !== false) {
        if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(message.sender?.name || 'New message', { body: message.content || 'Sent an attachment' });
        }
        toast(`${message.sender?.name || 'Someone'}: ${message.content || 'Sent an attachment'}`);
      }
      loadData();
    });
    socket.on('message_status_update', ({ messageId, from, status }) => {
      setMessages((current) => current.map((message) => {
        if (messageId && message._id === messageId) return { ...message, status };
        const senderId = message.sender?._id || message.sender;
        if (!messageId && from === activeRef.current?.id && senderId === userId) return { ...message, status };
        return message;
      }));
      loadData();
    });
    socket.on('pending_notifications', ({ count }) => {
      if (count > 0 && userRef.current?.settings?.notifications !== false) {
        toast(`You have ${count} unread message${count === 1 ? '' : 's'}.`);
      }
      loadData();
    });
    socket.on('groups_updated', loadData);
    socket.on('statuses_updated', loadData);
    socket.on('conversations_updated', loadData);
    socket.on('account_updated', (updatedUser) => {
      if (updatedUser._id === userId) saveUser(updatedUser);
    });
    socket.on('typing_indicator', ({ from, isTyping }) => {
      if (from === activeRef.current?.id) setTyping(Boolean(isTyping));
    });
    socket.on('user_online', (userId) => {
      setConversations((current) => current.map((entry) => entry.user._id === userId ? { ...entry, user: { ...entry.user, isOnline: true } } : entry));
    });
    socket.on('user_offline', ({ userId, lastSeen }) => {
      setConversations((current) => current.map((entry) => entry.user._id === userId ? { ...entry, user: { ...entry.user, isOnline: false, lastSeen } } : entry));
    });
    socket.on('incoming_call', (details) => setIncomingCall(details));
    socket.on('call_answered', async ({ answer }) => {
      if (peerRef.current) await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCall((current) => current ? { ...current, status: 'connected' } : current);
    });
    socket.on('ice_candidate', async ({ candidate }) => {
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('ICE candidate could not be added:', error);
      }
    });
    socket.on('call_declined', () => { toast('Call declined'); endCallRef.current?.(false); });
    socket.on('call_ended', () => { toast('Call ended'); endCallRef.current?.(false); });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [loadData, saveUser, userId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('chatbox-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let current = true;
    const params = active.type === 'group' ? { groupId: active.id, limit: 100 } : { userId: active.id, limit: 100 };
    api.get('/api/messages', { params })
      .then(({ data }) => {
        if (current) {
          setMessages(data.messages);
          setHasMoreMessages(data.hasMore);
          setMessageCursor(data.nextCursor);
        }
      })
      .catch((error) => toast.error(getErrorMessage(error)));
    if (active.type === 'user') api.put(`/api/messages/read/${active.id}`).catch(() => {});
    else api.put(`/api/messages/read/group/${active.id}`).catch(() => {});
    return () => { current = false; };
  }, [active]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (scrollAdjustmentRef.current) {
      const { scrollHeight, scrollTop } = scrollAdjustmentRef.current;
      container.scrollTop = scrollTop + (container.scrollHeight - scrollHeight);
      scrollAdjustmentRef.current = null;
    } else if (shouldStickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const loadOlderMessages = useCallback(async () => {
    if (!active || !hasMoreMessages || !messageCursor || loadingOlderRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const requestedConversation = `${active.type}:${active.id}`;
    const requestEpoch = paginationEpochRef.current;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const params = active.type === 'group'
        ? { groupId: active.id, before: messageCursor, limit: 100 }
        : { userId: active.id, before: messageCursor, limit: 100 };
      const { data } = await api.get('/api/messages', { params });
      if (requestEpoch !== paginationEpochRef.current ||
          `${activeRef.current?.type}:${activeRef.current?.id}` !== requestedConversation) return;
      if (data.messages.length) {
        scrollAdjustmentRef.current = { scrollHeight: container.scrollHeight, scrollTop: container.scrollTop };
        setMessages((current) => {
          const knownIds = new Set(current.map((message) => message._id));
          return [...data.messages.filter((message) => !knownIds.has(message._id)), ...current];
        });
      }
      setHasMoreMessages(data.hasMore);
      setMessageCursor(data.nextCursor);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      if (requestEpoch === paginationEpochRef.current) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    }
  }, [active, hasMoreMessages, messageCursor]);

  function handleMessageScroll(event) {
    const container = event.currentTarget;
    shouldStickToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (container.scrollTop < 80) loadOlderMessages();
  }

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) return undefined;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/users/search', { params: { q: query.trim() } });
        if (current) setResults(data.users);
      } catch (error) {
        if (current) toast.error(getErrorMessage(error));
      } finally {
        if (current) setSearching(false);
      }
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    if (user && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((error) => console.warn('Notification permission request failed:', error));
    }
  }, [user]);

  useEffect(() => {
    if (callStatus !== 'connected') return undefined;
    const timer = setInterval(() => setCall((current) => current ? { ...current, seconds: (current.seconds || 0) + 1 } : current), 1000);
    return () => clearInterval(timer);
  }, [callStatus]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    if (remoteVideoRef.current && peerRef.current?.remoteStream) remoteVideoRef.current.srcObject = peerRef.current.remoteStream;
    if (remoteAudioRef.current && peerRef.current?.remoteStream) remoteAudioRef.current.srcObject = peerRef.current.remoteStream;
  }, [call, incomingCall]);

  async function openConversation(person, type = 'user') {
    const id = person._id || person.id;
    setMessages([]);
    setHasMoreMessages(false);
    setMessageCursor(null);
    paginationEpochRef.current += 1;
    loadingOlderRef.current = false;
    setLoadingOlder(false);
    scrollAdjustmentRef.current = null;
    shouldStickToBottomRef.current = true;
    setActive({ ...person, id, type, user: person });
    setSection('chats');
    setQuery('');
    setResults([]);
    setTyping(false);
  }

  function onTyping(value) {
    setText(value);
    if (active?.type !== 'user') return;
    if (!typingActive.current) socketRef.current?.emit('typing', { to: active.id, isTyping: true });
    typingActive.current = true;
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('typing', { to: active.id, isTyping: false });
      typingActive.current = false;
    }, 900);
  }

  async function sendMessage(event) {
    event?.preventDefault();
    if (!active || (!text.trim() && !reply)) return;
    const content = text.trim();
    setText('');
    setReply(null);
    setBusy(true);
    socketRef.current?.emit('typing', { to: active.id, isTyping: false });
    try {
      const payload = active.type === 'group'
        ? { groupId: active.id, content, replyTo: reply?._id }
        : { to: active.id, content, replyTo: reply?._id };
      const { data } = await api.post('/api/messages', payload);
      setMessages((current) => current.some((item) => item._id === data.message._id) ? current : [...current, data.message]);
      loadData();
    } catch (error) {
      setText(content);
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file) {
    if (!file || !active) return;
    if (file.size > 100 * 1024 * 1024) return toast.error('Files must be 100 MB or smaller.');
    const data = new FormData();
    data.append('file', file);
    setBusy(true);
    try {
      const upload = await api.post('/api/upload', data);
      const type = upload.data.resourceType === 'video'
        ? (file.type.startsWith('audio/') ? 'audio' : 'video')
        : file.type.startsWith('image/') ? 'image' : 'document';
      const payload = {
        type,
        content: '',
        fileURL: upload.data.fileURL,
        fileName: upload.data.fileName,
        fileSize: upload.data.fileSize,
        mediaId: upload.data.mediaId,
        ...(active.type === 'group' ? { groupId: active.id } : { to: active.id }),
      };
      const response = await api.post('/api/messages', payload);
      setMessages((current) => [...current, response.data.message]);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createPeer(to) {
    const peer = new RTCPeerConnection(RTC_CONFIG);
    peer.remoteStream = new MediaStream();
    peer.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => peer.remoteStream.addTrack(track));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = peer.remoteStream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = peer.remoteStream;
    };
    peer.onicecandidate = (event) => {
      if (event.candidate) socketRef.current?.emit('ice_candidate', { to, candidate: event.candidate });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCall((current) => current ? { ...current, status: 'connected' } : current);
      if (['failed', 'disconnected'].includes(peer.connectionState)) toast.error('Call connection was interrupted.');
    };
    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current));
    peerRef.current = peer;
    return peer;
  }

  async function startCall(type) {
    if (!active || active.type !== 'user') return toast.error('Calls are available in direct chats.');
    if (!navigator.mediaDevices?.getUserMedia) return toast.error('Your browser does not support camera or microphone access.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      setCall({ to: active.id, person: activePerson, type, status: 'calling', seconds: 0 });
      const peer = await createPeer(active.id);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socketRef.current?.emit('call_offer', { to: active.id, offer, type });
      setTimeout(() => setCall((current) => {
        if (current?.status === 'calling') {
          socketRef.current?.emit('call_ended', { to: current.to });
          endCall(false);
          toast('No answer');
        }
        return current?.status === 'calling' ? null : current;
      }), 30000);
    } catch (error) {
      endCall(false);
      toast.error(error.name === 'NotAllowedError' ? 'Allow camera and microphone access to make a call.' : getErrorMessage(error));
    }
  }

  async function acceptCall() {
    if (!incomingCall || !navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === 'video',
      });
      localStreamRef.current = stream;
      const peer = await createPeer(incomingCall.from);
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socketRef.current?.emit('call_answer', { to: incomingCall.from, answer });
      const person = conversations.find((entry) => entry.user._id === incomingCall.from)?.user || { name: 'ChatBox contact' };
      setCall({ to: incomingCall.from, person, type: incomingCall.type, status: 'connecting', seconds: 0 });
      setIncomingCall(null);
    } catch (error) {
      toast.error(error.name === 'NotAllowedError' ? 'Allow camera and microphone access to answer.' : getErrorMessage(error));
      socketRef.current?.emit('call_declined', { to: incomingCall.from });
      endCall(false);
    }
  }

  async function chooseEmoji(emojiData) {
    setText((current) => `${current}${emojiData.emoji}`);
  }

  async function updateSettings(settings) {
    try {
      const { data } = await api.put('/api/users/settings', settings);
      saveUser(data.user);
      toast.success('Your settings are saved.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  async function onLogout() {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Local logout still proceeds if the network is unavailable.
    }
    clearAuthToken();
    if (auth) await signOut(auth).catch(() => {});
    socketRef.current?.disconnect();
    clearUser();
    navigate('/login', { replace: true });
  }

  async function onDeleteAccount() {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) throw new Error('Firebase session is unavailable.');
    const idToken = await firebaseUser.getIdToken();
    await api.delete('/api/auth/delete-account', { data: { idToken } });
    clearAuthToken();
    await signOut(auth).catch(() => {});
    socketRef.current?.disconnect();
    clearUser();
    navigate('/login', { replace: true });
  }

  if (booting) return <div className="boot-screen"><div className="spinner" /><span>Making a little space…</span></div>;
  if (!user) return <LoginPage />;

  return (
    <div className={`app-screen ${active ? 'conversation-open' : ''}`}>
      <aside className="side-rail">
        <div className="rail-brand"><MessageCircle size={22} fill="currentColor" /><span>chatbox</span></div>
        <div className="rail-actions" aria-label="Main navigation">
          <RailButton icon={<MessageCircle />} label="Chats" active={section === 'chats'} badge={conversations.reduce((sum, item) => sum + item.unread, 0)} onClick={() => setSection('chats')} />
          <RailButton icon={<CircleUserRound />} label="Status" active={section === 'status'} onClick={() => setSection('status')} />
          <RailButton icon={<Phone />} label="Calls" active={section === 'calls'} onClick={() => setSection('calls')} />
          <RailButton icon={<UserPlus />} label="Groups" active={section === 'groups'} onClick={() => setSection('groups')} />
        </div>
        <div className="rail-bottom">
          <button className="rail-icon" aria-label="Toggle dark mode" onClick={() => updateSettings({ theme: theme === 'light' ? 'dark' : 'light' })}>{theme === 'light' ? <Moon /> : <Sun />}</button>
          <button className="rail-profile" aria-label="Open profile" onClick={() => setShowProfile(true)}><Avatar person={user} size="small" /></button>
        </div>
      </aside>

      <aside className="inbox-panel">
        <header className="inbox-header">
          <div className="inbox-title-row">
            <div>
              <span className="eyebrow">YOUR SPACE</span>
              <h1>{section === 'chats' ? 'Messages' : section === 'status' ? 'Around you' : section === 'calls' ? 'Calls' : 'Your groups'}</h1>
            </div>
            <button className="icon-button" aria-label="Settings" onClick={() => setShowProfile(true)}><Settings size={19} /></button>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setSearching(event.target.value.trim().length >= 2); }} placeholder="Find someone by name…" aria-label="Search users" />
            {query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}
          </label>
        </header>

        <div className="inbox-content">
          {query.length >= 2 ? (
            <section className="list-section">
              <div className="section-heading">PEOPLE</div>
              {results.length ? results.map((person) => (
                <button key={person._id} className="person-row" onClick={() => openConversation(person)}>
                  <Avatar person={person} online={person.isOnline} />
                  <span className="person-copy"><b>{person.name}</b><small>@{person.username}</small></span>
                  <MessageCircle size={17} className="row-action" />
                </button>
              )) : <p className="quiet-state">{searching ? 'Searching your community…' : 'No people found yet.'}</p>}
            </section>
          ) : section === 'chats' ? (
            <>
              {statuses.length > 0 && <StatusStrip statuses={statuses} currentUser={user} onCreate={() => setSection('status')} onOpenStatus={(status) => { setViewingStatus(status); if (status.user?._id !== user._id) markStatusViewed(status._id, loadData); }} />}
              <div className="section-heading section-heading-row"><span>RECENT</span><button aria-label="New group" onClick={() => setShowNewGroup(true)}><Plus size={16} /> New group</button></div>
              {conversations.map((entry) => (
                <button key={entry.user._id} className={`conversation-row ${active?.id === entry.user._id ? 'selected' : ''}`} onClick={() => openConversation(entry.user)}>
                  <Avatar person={entry.user} online={entry.user.isOnline} />
                  <span className="conversation-copy">
                    <span className="conversation-line"><b>{entry.user.name}</b><time>{formatTime(entry.lastMessage.createdAt)}</time></span>
                    <span className="conversation-line"><small>{entry.lastMessage.sender?._id === user._id && <CheckCheck size={14} className="sent-check" />} {entry.lastMessage.content || 'Attachment'}</small>{entry.unread > 0 && <i className="unread-badge">{entry.unread}</i>}</span>
                  </span>
                </button>
              ))}
              {groups.map((group) => (
                <button key={group._id} className={`conversation-row ${active?.id === group._id ? 'selected' : ''}`} onClick={() => openConversation(group, 'group')}>
                  <Avatar person={{ name: group.name, photoURL: group.photoURL }} />
                  <span className="conversation-copy"><span className="conversation-line"><b>{group.name}</b><small>GROUP</small></span><span className="conversation-line"><small>{group.members.length} members</small></span></span>
                </button>
              ))}
              {!conversations.length && !groups.length && <EmptyPanel title="A good conversation starts here" detail="Search for a friend by name or username to say hello." />}
            </>
          ) : section === 'status' ? (
            <StatusPage statuses={statuses} user={user} onChanged={loadData} />
          ) : section === 'calls' ? (
            <section className="list-section"><div className="section-heading">CALLS</div><EmptyPanel title="Your call history lives here" detail="Open any direct conversation to start a voice or video call." /></section>
          ) : (
            <GroupsPage groups={groups} onSelect={(group) => openConversation(group, 'group')} onCreate={() => setShowNewGroup(true)} />
          )}
        </div>

        <footer className="inbox-footer">
          <button onClick={() => setShowProfile(true)}><Avatar person={user} size="small" /><span><b>{user.name}</b><small>@{user.username}</small></span><MoreHorizontal size={19} /></button>
        </footer>
      </aside>

      <main className={`chat-panel ${active ? 'chat-active' : ''}`}>
        {!active ? (
          <div className="welcome-panel">
            <div className="welcome-illustration"><div className="welcome-orbit"><MessageCircle size={45} /></div><span className="sparkle sparkle-a">✳</span><span className="sparkle sparkle-b">✳</span></div>
            <span className="eyebrow">A LITTLE LESS NOISE, A LITTLE MORE YOU</span>
            <h2>Make a moment<br />of <em>connection.</em></h2>
            <p>Pick up a conversation or find someone new.<br />Your people are just a message away.</p>
            <button className="primary-button" onClick={() => document.querySelector('.search-box input')?.focus()}><Search size={16} /> Find someone</button>
            <div className="welcome-footnote"><span /> Your messages are yours alone.</div>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <button className="mobile-back icon-button" aria-label="Back to messages" onClick={() => setActive(null)}><ArrowLeft size={20} /></button>
              <button className="header-person" onClick={() => setShowProfile(true)}>
                <Avatar person={activePerson} online={activePerson?.isOnline} />
                <span><b>{activePerson?.name || activePerson?.username}</b><small>{active?.type === 'group' ? `${activePerson?.members?.length || 0} members` : typing ? 'typing…' : activePerson?.isOnline ? 'here now' : formatLastSeen(activePerson?.lastSeen)}</small></span>
              </button>
              <div className="chat-header-actions">
                {active.type === 'user' && <>
                  <button className="icon-button" aria-label="Start voice call" onClick={() => startCall('voice')}><Phone size={19} /></button>
                  <button className="icon-button" aria-label="Start video call" onClick={() => startCall('video')}><Video size={20} /></button>
                </>}
                <button className="icon-button" aria-label="More chat options" onClick={() => toast('More chat settings are coming soon.')}><MoreHorizontal size={21} /></button>
              </div>
            </header>
            <div className="message-scroll" ref={scrollRef} onScroll={handleMessageScroll}>
              <div className="conversation-intro">
                <Avatar person={activePerson} size="large" />
                <b>{activePerson?.name || activePerson?.username}</b>
                {active.type === 'user' && <span>@{activePerson?.username} · {activePerson?.bio}</span>}
                {active.type === 'group' && <span>Created {formatDate(activePerson?.createdAt)}</span>}
                <small>Messages are just between you and {active.type === 'group' ? 'the group' : activePerson?.name}.</small>
              </div>
              {loadingOlder && <div className="history-loader" role="status">Loading older messages…</div>}
              {messages.length === 0 && <div className="empty-chat">This is the beginning of something good. Say hello.</div>}
              {messages.map((message, index) => {
                const own = message.sender?._id === user._id || message.sender === user._id;
                const prior = messages[index - 1];
                const showDate = !prior || new Date(prior.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                return (
                  <div key={message._id} className={`message-wrap ${own ? 'message-own' : ''}`}>
                    {showDate && <div className="date-divider"><span>{formatDate(message.createdAt)}</span></div>}
                    <div className={`message-bubble ${own ? 'outgoing' : 'incoming'}`}>
                      {active.type === 'group' && !own && <b className="sender-name">{message.sender?.name}</b>}
                      {message.replyTo && <div className="quoted-message">{message.replyTo.content || 'Attachment'}</div>}
                      {message.type === 'image' && <a href={message.fileURL} target="_blank" rel="noreferrer"><img className="message-image" src={message.fileURL} alt={message.fileName || 'Shared image'} /></a>}
                      {message.type === 'video' && <video className="message-video" src={message.fileURL} controls preload="metadata" />}
                      {message.type === 'audio' && <audio src={message.fileURL} controls />}
                      {message.type === 'document' && <a className="document-link" href={message.fileURL} target="_blank" rel="noreferrer"><FileText size={23} /><span><b>{message.fileName || 'Document'}</b><small>{formatSize(message.fileSize)}</small></span></a>}
                      {message.type === 'text' && message.content && <p>{message.content}</p>}
                      <span className="message-meta"><time>{formatTime(message.createdAt)}</time>{own && (message.status === 'read' ? <CheckCheck size={14} className="read-check" /> : <Check size={14} />)}</span>
                      <button className="message-more" aria-label="Message actions" onClick={() => setMenuMessage(menuMessage === message._id ? null : message._id)}><MoreHorizontal size={14} /></button>
                      {menuMessage === message._id && <div className="message-menu"><button onClick={() => { setReply(message); setMenuMessage(null); }}>Reply</button><button onClick={() => navigator.clipboard.writeText(message.content || message.fileURL).then(() => toast.success('Copied'))}>Copy</button></div>}
                    </div>
                  </div>
                );
              })}
              {typing && <div className="typing-bubble"><i /><i /><i /><span>typing</span></div>}
            </div>
            <form className="composer" onSubmit={sendMessage}>
              {reply && <div className="reply-bar"><span><small>REPLYING TO</small>{reply.content || 'Attachment'}</span><button type="button" aria-label="Cancel reply" onClick={() => setReply(null)}><X size={17} /></button></div>}
              <div className="composer-row">
                <label className="icon-button attach-button" aria-label="Attach a file"><Paperclip size={19} /><input type="file" accept="image/*,video/*,audio/*,application/pdf" onChange={(event) => { uploadFile(event.target.files?.[0]); event.target.value = ''; }} /></label>
                <div className="composer-input"><input value={text} onChange={(event) => onTyping(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Write something kind…" aria-label="Message" maxLength={10000} /><button type="button" title="Add emoji" className="icon-button emoji-button" onClick={() => document.getElementById('emoji-picker')?.classList.toggle('visible')}><Smile size={19} /></button>                <div id="emoji-picker" className="emoji-panel"><Suspense fallback={<div className="emoji-loading">Loading emoji…</div>}><EmojiPicker onEmojiClick={chooseEmoji} height={350} width={300} /></Suspense></div></div>
                <button type="submit" className="send-button" aria-label="Send message" disabled={busy || !text.trim()}><Send size={18} /></button>
              </div>
              <div className="composer-hint">Press <kbd>Enter</kbd> to send <span>·</span> Keep it kind.</div>
            </form>
          </>
        )}
      </main>

      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} onSave={saveUser} onUpdateSettings={updateSettings} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} onCreated={(group) => { setGroups((current) => [group, ...current]); openConversation(group, 'group'); setShowNewGroup(false); }} />}
      {viewingStatus && <StoryViewer status={viewingStatus} onClose={() => setViewingStatus(null)} />}
      {incomingCall && <IncomingCallModal details={incomingCall} person={conversations.find((entry) => entry.user._id === incomingCall.from)?.user} onAccept={acceptCall} onDecline={() => { socketRef.current?.emit('call_declined', { to: incomingCall.from }); setIncomingCall(null); }} />}
      {call && <CallModal call={call} localVideoRef={localVideoRef} remoteVideoRef={remoteVideoRef} remoteAudioRef={remoteAudioRef} muted={muted} cameraOff={cameraOff} onMute={() => { localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !track.enabled; }); setMuted((value) => !value); }} onCamera={() => { localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !track.enabled; }); setCameraOff((value) => !value); }} onEnd={() => endCall()} />}
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <nav className="mobile-nav">
        <RailButton icon={<MessageCircle />} label="Chats" active={section === 'chats'} onClick={() => { setSection('chats'); setActive(null); setMessages([]); }} />
        <RailButton icon={<CircleUserRound />} label="Status" active={section === 'status'} onClick={() => { setSection('status'); setActive(null); setMessages([]); }} />
        <RailButton icon={<Phone />} label="Calls" active={section === 'calls'} onClick={() => { setSection('calls'); setActive(null); setMessages([]); }} />
        <RailButton icon={<CircleUserRound />} label="Profile" onClick={() => setShowProfile(true)} />
      </nav>
    </div>
  );
}

function RailButton({ icon, label, active, badge, onClick }) {
  return <button className={`rail-button ${active ? 'active' : ''}`} aria-label={label} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span>{badge > 0 && <i>{badge}</i>}</button>;
}

function EmptyPanel({ title, detail }) {
  return <div className="empty-panel"><div className="empty-icon"><MessageCircle size={21} /></div><b>{title}</b><p>{detail}</p></div>;
}

function StatusStrip({ statuses, currentUser, onCreate, onOpenStatus }) {
  const own = statuses.find((status) => status.user?._id === currentUser._id);
  return (
    <section className="status-strip">
      <button className="status-own" onClick={onCreate}>
        <span className="status-ring"><Avatar person={currentUser} /></span><span><b>My status</b><small>{own ? 'Add to your story' : 'Share a small moment'}</small></span><Plus size={16} />
      </button>
      {statuses.filter((status) => status.user?._id !== currentUser._id).slice(0, 4).map((status) => (
        <button key={status._id} className="status-mini" onClick={() => onOpenStatus(status)}>
          <span className="status-ring"><Avatar person={status.user} /></span><span><b>{status.user?.name}</b><small>{formatTime(status.createdAt)}</small></span>
        </button>
      ))}
    </section>
  );
}

function StatusPage({ statuses, user, onChanged }) {
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#315c55');
  const [file, setFile] = useState(null);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const own = statuses.filter((status) => status.user?._id === user._id);
  const others = statuses.filter((status) => status.user?._id !== user._id);
  async function postStatus(event) {
    event.preventDefault();
    if (!content.trim() && !file) return;
    setBusy(true);
    try {
      let payload = { type: 'text', content, backgroundColor: color };
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await api.post('/api/upload', formData);
        payload = {
          ...payload,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          fileURL: uploaded.data.fileURL,
          mediaId: uploaded.data.mediaId,
          content: '',
        };
      }
      await api.post('/api/status', payload);
      setContent('');
      setFile(null);
      toast.success('Your status is up for 24 hours.');
      onChanged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="status-page">
      <form className="status-create" onSubmit={postStatus} style={{ backgroundColor: color }}>
        <label htmlFor="status-text">A thought to share?</label>
        <textarea id="status-text" value={content} maxLength={700} onChange={(event) => setContent(event.target.value)} placeholder={file ? file.name : 'Write a little something…'} />
        <div className="status-create-actions"><div className="swatches">{['#315c55', '#725c8c', '#9d634d', '#315c7c'].map((value) => <button key={value} type="button" className={color === value ? 'chosen' : ''} style={{ backgroundColor: value }} onClick={() => setColor(value)} aria-label={`Set status background ${value}`} />)}<label className="status-file-button" aria-label="Choose status photo or video"><Image size={16} /><input type="file" accept="image/*,video/*" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label></div><button type="submit" disabled={busy || (!content.trim() && !file)}>{busy ? 'Sharing…' : 'Share'}</button></div>
      </form>
      {[['YOUR STATUS', own], ['RECENT UPDATES', others]].map(([heading, items]) => <section key={heading}><div className="section-heading">{heading}</div>{items.length ? items.map((status) => <StatusRow key={status._id} status={status} onViewed={() => { setViewingStatus(status); if (status.user?._id !== user._id) markStatusViewed(status._id, onChanged); }} />) : <p className="quiet-state">Nothing here yet.</p>}</section>)}
      {viewingStatus && <StoryViewer status={viewingStatus} onClose={() => setViewingStatus(null)} />}
    </div>
  );
}

function StatusRow({ status, onViewed }) {
  return (
    <button className="status-row" onClick={onViewed}>
      <span className="status-ring"><Avatar person={status.user} /></span>
      <span><b>{status.user?.name || 'Your status'}</b><small>{status.type === 'text' ? status.content : 'Shared a moment'} · {formatTime(status.createdAt)}</small></span>
      {status.viewerCount > 0 && <small className="viewer-count">{status.viewerCount} views</small>}
    </button>
  );
}

function StoryViewer({ status, onClose }) {
  return <div className="story-overlay" role="dialog" aria-modal="true" aria-label="View status" onClick={onClose}>
    <button className="story-close" aria-label="Close status" onClick={onClose}><X size={20} /></button>
    <div className="story-card" style={{ backgroundColor: status.backgroundColor || '#315c55' }} onClick={(event) => event.stopPropagation()}>
      <div className="story-progress"><i /></div>
      <div className="story-author"><Avatar person={status.user} size="small" /><span><b>{status.user?.name || 'Your status'}</b><small>{formatTime(status.createdAt)}</small></span></div>
      {status.type === 'text' ? <p>{status.content}</p> : status.type === 'video' ? <video src={status.fileURL} autoPlay controls playsInline /> : <img src={status.fileURL} alt="Shared status" />}
      {status.user?.name && status.viewerCount > 0 && <small className="story-views">{status.viewerCount} views</small>}
    </div>
  </div>;
}

async function markStatusViewed(id, onChanged) {
  try {
    await api.post(`/api/status/${id}/view`);
    onChanged();
  } catch (error) {
    toast.error(getErrorMessage(error));
  }
}

function GroupsPage({ groups, onSelect, onCreate }) {
  return <section className="groups-page"><div className="section-heading section-heading-row"><span>YOUR GROUPS</span><button onClick={onCreate}><Plus size={16} /> Create</button></div>{groups.map((group) => <button key={group._id} className="group-row" onClick={() => onSelect(group)}><Avatar person={{ name: group.name, photoURL: group.photoURL }} /><span><b>{group.name}</b><small>{group.members.length} people · {group.description || 'A shared space'}</small></span><ChevronDown size={16} /></button>)}{groups.length === 0 && <EmptyPanel title="Find your people" detail="Create a group to bring your favorite people together." />}</section>;
}

function NewGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/users/search', { params: { q: query } });
        if (active) setResults(data.users);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/api/groups', { name, members: selected.map((person) => person._id) });
      onCreated(data.group);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Start a group" onClose={onClose}>
      <form className="modal-form" onSubmit={create}>
        <label className="input-label">Group name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekend plans" required maxLength={80} /></label>
        <label className="input-label">Add people<input value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); }} placeholder="Search by name or username" /></label>
        <div className="selected-people">{selected.map((person) => <button type="button" key={person._id} onClick={() => setSelected((current) => current.filter((item) => item._id !== person._id))}>{person.name} <X size={13} /></button>)}</div>
        <div className="modal-results">{results.filter((person) => !selected.some((item) => item._id === person._id)).map((person) => <button type="button" key={person._id} onClick={() => setSelected((current) => [...current, person])}><Avatar person={person} size="small" />{person.name}<Plus size={15} /></button>)}</div>
        <button className="primary-button full-button" disabled={busy || !name.trim() || !selected.length}>{busy ? 'Creating…' : `Create group${selected.length ? ` · ${selected.length + 1} people` : ''}`}</button>
      </form>
    </Modal>
  );
}

function ProfileModal({ user, onClose, onSave, onUpdateSettings, onLogout, onDeleteAccount }) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [username, setUsername] = useState(user.username);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [photoMediaId, setPhotoMediaId] = useState(user.photoMedia?._id || user.photoMedia || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('profile');
  const settings = { theme: 'light', notifications: true, ...user.settings };
  const [privacy, setPrivacy] = useState({
    lastSeen: 'everyone',
    photo: 'everyone',
    online: 'everyone',
    readReceipts: true,
    ...user.privacy,
  });
  const [availability, setAvailability] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  useEffect(() => {
    if (username === user.username || !/^[a-z0-9_]{3,20}$/i.test(username)) return undefined;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/users/availability/${encodeURIComponent(username)}`);
        if (current) setAvailability(data.available);
      } catch {
        if (current) setAvailability(null);
      }
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [username, user.username]);
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (username !== user.username) await api.patch('/api/auth/username', { username });
      const { data } = await api.put('/api/users/profile', {
        name,
        bio,
        photoURL,
        ...(photoMediaId ? { photoMediaId } : {}),
      });
      onSave(data.user);
      toast.success('Your profile is looking good.');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function uploadPhoto(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('Profile photos must be 10 MB or smaller.');
    const formData = new FormData();
    formData.append('file', file);
    setUploadingPhoto(true);
    try {
      const { data } = await api.post('/api/upload', formData);
      setPhotoURL(data.fileURL);
      setPhotoMediaId(data.mediaId);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploadingPhoto(false);
    }
  }
  async function savePrivacy(field, value) {
    const updated = { ...privacy, [field]: value };
    setPrivacy(updated);
    try {
      const { data } = await api.put('/api/users/privacy', updated);
      onSave(data.user);
      toast.success('Privacy settings updated.');
    } catch (error) {
      setPrivacy(privacy);
      toast.error(getErrorMessage(error));
    }
  }
  async function saveSetting(field, value) {
    await onUpdateSettings({ [field]: value });
  }
  async function deleteAccount() {
    setDeletingAccount(true);
    try {
      await onDeleteAccount();
      toast.success('Account deleted.');
    } catch (error) {
      setDeletingAccount(false);
      toast.error(getErrorMessage(error));
    }
  }
  if (showDeleteConfirmation) {
    return (
      <Modal title="Delete account forever?" onClose={() => { if (!deletingAccount) setShowDeleteConfirmation(false); }}>
        <div className="delete-account-confirmation" role="alertdialog" aria-describedby="delete-account-warning">
          <p id="delete-account-warning">
            This permanently deletes your profile, messages, files, statuses, sessions, and account. This cannot be undone.
          </p>
          <div className="delete-account-actions">
            <button type="button" className="primary-button" disabled={deletingAccount} onClick={() => setShowDeleteConfirmation(false)}>Cancel</button>
            <button type="button" className="danger-button" disabled={deletingAccount} onClick={deleteAccount}>
              {deletingAccount ? <><span className="spinner small-spinner" /> Deleting…</> : 'Delete Forever'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Your space" onClose={onClose}>
      <div className="profile-tabs"><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button><button className={tab === 'privacy' ? 'active' : ''} onClick={() => setTab('privacy')}>Privacy</button><button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button></div>
      {tab === 'profile' ? <form className="modal-form" onSubmit={save}>
        <div className="profile-preview"><label className="profile-photo-picker" aria-label="Change profile photo"><Avatar person={{ ...user, name, photoURL }} size="large" /><input type="file" accept="image/*" onChange={(event) => uploadPhoto(event.target.files?.[0])} /><span>{uploadingPhoto ? 'Uploading…' : 'Change photo'}</span></label><span><b>{name}</b><small>@{username}</small></span></div>
        <label className="input-label">Display name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
        <label className="input-label">Username<div className="username-input"><span>@</span><input value={username} onChange={(event) => { const value = event.target.value.toLowerCase(); setUsername(value); setAvailability(value === user.username); }} required minLength={3} maxLength={20} /></div><small className={`availability ${availability === false ? 'unavailable' : ''}`}>{availability === false ? 'This username is already taken.' : '3–20 letters, numbers, or underscores'}</small></label>
        <label className="input-label">About you<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={100} rows={3} /></label>
        <button className="primary-button full-button" disabled={busy || availability === false}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="logout-button" onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </form> : tab === 'privacy' ? <div className="privacy-panel">
        <p>Your account is connected with Google. Your direct messages are visible only to you and the recipient.</p>
        {['lastSeen', 'photo', 'online'].map((field) => <label className="privacy-setting" key={field}><span><b>{field === 'lastSeen' ? 'Last seen' : field === 'photo' ? 'Profile photo' : 'Online status'}</b><small>Who can see this information</small></span><select value={privacy[field]} onChange={(event) => savePrivacy(field, event.target.value)}><option value="everyone">Everyone</option>{field !== 'online' && <option value="contacts">My contacts</option>}<option value="nobody">Nobody</option></select></label>)}
        <label className="privacy-toggle"><span><b>Read receipts</b><small>Share when you have read a message</small></span><input type="checkbox" checked={privacy.readReceipts} onChange={(event) => savePrivacy('readReceipts', event.target.checked)} /></label>
        <button className="logout-button" onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </div> : <div className="privacy-panel">
        <label className="privacy-setting"><span><b>Appearance</b><small>Sync your theme across devices</small></span><select value={settings.theme} onChange={(event) => saveSetting('theme', event.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label className="privacy-toggle"><span><b>Notifications</b><small>Keep message notifications enabled</small></span><input type="checkbox" checked={settings.notifications} onChange={(event) => saveSetting('notifications', event.target.checked)} /></label>
        <button type="button" className="danger-outline-button" onClick={() => setShowDeleteConfirmation(true)}>Delete account forever</button>
        <button className="logout-button" onClick={onLogout}><LogOut size={16} /> Sign out</button>
      </div>}
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></header>{children}</section></div>;
}

function IncomingCallModal({ details, person, onAccept, onDecline }) {
  return <div className="call-overlay"><div className="incoming-call-card"><Avatar person={person || { name: 'Someone' }} size="xlarge" /><span className="eyebrow">INCOMING {details.type.toUpperCase()} CALL</span><h2>{person?.name || 'A ChatBox friend'}</h2><p>Someone would love to talk.</p><div className="call-actions"><button className="decline-call" aria-label="Decline call" onClick={onDecline}><PhoneOff /></button><button className="accept-call" aria-label="Accept call" onClick={onAccept}><Phone /></button></div></div></div>;
}

function CallModal({ call, localVideoRef, remoteVideoRef, remoteAudioRef, muted, cameraOff, onMute, onCamera, onEnd }) {
  const time = `${String(Math.floor((call.seconds || 0) / 60)).padStart(2, '0')}:${String((call.seconds || 0) % 60).padStart(2, '0')}`;
  const video = call.type === 'video';
  return <div className={`call-overlay ${video ? 'video-call-overlay' : ''}`}>
    {video && <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />}
    {!video && <audio ref={remoteAudioRef} autoPlay />}
    {video && <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />}
    <div className="call-card"><Avatar person={call.person} size="xlarge" /><span className="eyebrow">{call.status === 'calling' ? 'CALLING' : call.status === 'connected' ? 'CONNECTED' : 'CONNECTING'}</span><h2>{call.person?.name || 'ChatBox friend'}</h2><p>{call.status === 'connected' ? time : call.status === 'calling' ? 'Waiting for them to pick up…' : 'Finding a clear connection…'}</p><div className="call-actions"><button className={muted ? 'control-active' : ''} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} onClick={onMute}>{muted ? <MicOff /> : <Mic />}</button>{video && <button className={cameraOff ? 'control-active' : ''} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'} onClick={onCamera}>{cameraOff ? <VideoOff /> : <Video />}</button>}<button className="decline-call" aria-label="End call" onClick={onEnd}><PhoneOff /></button></div></div>
  </div>;
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function formatLastSeen(value) {
  if (!value) return 'offline';
  return `last here ${formatTime(value)}`;
}

function formatSize(bytes = 0) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Root() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="/setup" element={<SetupPage />} /><Route path="*" element={<AppShell />} /></Routes></BrowserRouter>;
}

export default Root;
