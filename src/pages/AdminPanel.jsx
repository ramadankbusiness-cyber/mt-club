import { useState, useEffect, useContext, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa";
import { Users, Settings, Plus, UserPlus, QrCode, Calendar, Save, Image, Trash2, Upload, User, Download, Search, MapPin, Award, Pencil, Star, Menu, X, Bell, Send } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import axios from "../utils/axios";
import { QRCodeCanvas } from "qrcode.react";
import * as XLSX from "xlsx-js-style";
import { useToast } from "../components/Toast";

const PLATFORM_ICONS = { facebook: <FaFacebook />, instagram: <FaInstagram />, tiktok: <FaTiktok /> };

const INITIAL_COMMITTEES = [
  { id: "chairman", label: "Chairman of the MT Club Board", headName: "", headImage: "" },
  { id: "leadership", label: "Team Leaders", headName: "", headImage: "", viceName: "", viceImage: "" },
  { id: "oc", label: "OC", headName: "", headImage: "", viceName: "", viceImage: "", leader1Name: "", leader1Image: "", leader2Name: "", leader2Image: "" },
  { id: "tech", label: "Tech", headName: "", headImage: "", viceName: "", viceImage: "" },
  { id: "pr", label: "PR", headName: "", headImage: "", viceName: "", viceImage: "" },
  { id: "hr", label: "HR", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
  { id: "logistics", label: "Logistics", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
  { id: "firstaid", label: "First Aid", headName: "", headImage: "", viceName: "", viceImage: "" },
  { id: "media", label: "Media", headName: "", headImage: "", viceName: "", viceImage: "" },
];

function MemberCard({ committeeId, role, data, editTeamName, setEditTeamName, onSave, onDeleteImage }) {
  const key = `${committeeId}-${role}`;
  const currentName = editTeamName[key] !== undefined ? editTeamName[key] : data?.name || "";

  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
        {data?.imageUrl ? (
          <img src={data.imageUrl} alt={data.name || role} className="w-full h-full object-cover" />
        ) : (
          <User size={28} className="text-gray-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <input 
          type="text" 
          value={currentName}
          onChange={e => setEditTeamName({ ...editTeamName, [key]: e.target.value })}
          placeholder="Enter name"
          className="w-full bg-transparent border-b border-white/20 text-white font-medium focus:outline-none focus:border-cyan-400" 
        />
        <p className="text-xs text-gray-400 mt-1">{role === "head" ? (committeeId === "chairman" ? "Chairman" : "Head") : role === "vice" ? "Vice Head" : role === "leader1" ? "Leader 1" : role === "leader2" ? "Leader 2" : "Leader"}</p>
        <button 
          type="button"
          onClick={() => onSave(committeeId, role, data?.id, currentName, null)} 
          className="text-xs text-cyan-400 mt-1 hover:underline block"
        >
          Save name
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <label className="cursor-pointer p-2 bg-cyan-500/20 rounded hover:bg-cyan-500/40 transition flex items-center justify-center">
          <Upload size={16} className="text-cyan-400" />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={e => { if (e.target.files?.[0]) onSave(committeeId, role, data?.id, currentName, e.target.files[0]); }} 
          />
        </label>
        {data?.imageUrl ? (
          <button type="button" onClick={() => onDeleteImage(committeeId, role, data?.id)} className="p-2 bg-red-500/20 rounded hover:bg-red-500/40 transition flex items-center justify-center">
            <Trash2 size={16} className="text-red-400" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, logout } = useContext(AuthContext);
  const toast = useToast();
  const [activePage, setActivePage] = useState("dashboard");
  const [themeColor, setThemeColor] = useState("cyan");
  const [socialData, setSocialData] = useState([]);
  const [posts, setPosts] = useState([]);
  const [team, setTeam] = useState(INITIAL_COMMITTEES);
  const [loading, setLoading] = useState(true);
  const [editPost, setEditPost] = useState(null);
  const [newPost, setNewPost] = useState({ title: "", platform: "instagram", date: "", likes: 0, shares: 0 });
  const [editSettings, setEditSettings] = useState({});
  const [editTeamName, setEditTeamName] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [stats, setStats] = useState(null);

  const token = user?.token;

  const fetchTeamData = async () => {
    try {
      const res = await axios.get("/api/team");
      const serverData = res.data || {};
      setTeam(prev => prev.map(c => {
        const doc = serverData[c.id];
        return {
          ...c,
          headId: doc?.head?.id ?? null,
          headName: doc?.head?.name || "",
          headImage: doc?.head?.imageUrl || "",
          viceId: doc?.vice?.id ?? null,
          viceName: doc?.vice?.name || "",
          viceImage: doc?.vice?.imageUrl || "",
          leader1Id: doc?.leader1?.id ?? null,
          leader1Name: doc?.leader1?.name || "",
          leader1Image: doc?.leader1?.imageUrl || "",
          leader2Id: doc?.leader2?.id ?? null,
          leader2Name: doc?.leader2?.name || "",
          leader2Image: doc?.leader2?.imageUrl || "",
          leaderId: doc?.leader?.id ?? null,
          leaderName: doc?.leader?.name || "",
          leaderImage: doc?.leader?.imageUrl || "",
        };
      }));
    } catch (err) {
      console.error("Fetch team error:", err.message);
    }
  };

  useEffect(() => {
    if (!token) return;

    fetchTeamData();

    if (user?.role === "admin") {
      Promise.all([
        axios.get("/api/settings", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/posts", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/admin/members", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/admin/events", { headers: { Authorization: `Bearer ${token}` } }),
        axios.get("/api/gallery", { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(([sRes, pRes, membersRes, eventsRes, galleryRes]) => {
          setSocialData(Array.isArray(sRes.data) ? sRes.data : []);
          setPosts(Array.isArray(pRes.data) ? pRes.data : []);
          const settings = {};
          (Array.isArray(sRes.data) ? sRes.data : []).forEach(s => { settings[s.platform] = { link: s.link }; });
          setEditSettings(settings);
          const members = Array.isArray(membersRes.data) ? membersRes.data : [];
          const events = Array.isArray(eventsRes.data) ? eventsRes.data : [];
          const gallery = Array.isArray(galleryRes.data) ? galleryRes.data : [];
          setStats({
            totalMembers: members.length,
            totalLeaders: members.filter(m => m.role === "leader").length,
            totalAdmins: members.filter(m => m.role === "admin").length,
            eventsCount: events.length,
            galleryCount: gallery.length,
          });
        })
        .catch(err => {
          console.error("Admin initial fetch error:", err.response || err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const isAdmin = user?.role === "admin";

  if (!user || !["admin", "leader"].includes(user.role)) return <Navigate to="/" />;

  const COMMITTEE_OPTIONS = [
    { value: "leadership", label: "MTC" },
    { value: "oc", label: "OC" },
    { value: "tech", label: "Tech" },
    { value: "pr", label: "PR" },
    { value: "hr", label: "HR" },
    { value: "logistics", label: "Logistics" },
    { value: "firstaid", label: "First Aid" },
    { value: "media", label: "Media" },
  ];

  const saveSettings = () => {
    Object.entries(editSettings).forEach(([platform, data]) => {
      axios.put(`/api/settings/${platform}`, { link: data.link }, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setSocialData(prev => prev.map(s => s.platform === platform ? res.data : s)));
    });
    toast.success("Settings saved!");
  };

  const addPost = () => {
    if (!newPost.title || !newPost.platform) return;
    axios.post("/api/posts", newPost, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setPosts([res.data, ...posts]);
        setNewPost({ title: "", platform: "instagram", date: "", likes: 0, shares: 0 });
      })
      .catch(() => {});
  };

  const deletePost = (id) => {
    axios.delete(`/api/posts/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => setPosts(posts.filter(p => p.id !== id)))
      .catch(() => {});
  };

  const updatePost = () => {
    if (!editPost) return;
    axios.put(`/api/posts/${editPost.id}`, editPost, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setPosts(posts.map(p => p.id === editPost.id ? res.data : p));
        setEditPost(null);
      })
      .catch(() => {});
  };

  const handleSave = async (committeeId, role, teamRowId, nameValue, fileInput) => {
    try {
      let base64Image = null;

      if (fileInput) {
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(fileInput);
        });
      }

      const response = await axios.put('/api/team/update', {
        id: teamRowId,
        committeeId,
        role,
        name: nameValue,
        image: base64Image,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("تم الحفظ في قاعدة البيانات بنجاح!");
      fetchTeamData();
    } catch (error) {
      toast.error("فشل الحفظ: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteImage = async (committeeId, role, teamRowId) => {
    if (!await showConfirm("هل أنت متأكد من حذف هذه الصورة؟")) return;
    try {
      await axios.put("/api/team/update", { id: teamRowId, committeeId, role, image: "" }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success("تم حذف الصورة!");
      fetchTeamData();
    } catch (err) {
      toast.error("Failed to delete image: " + (err.response?.data?.message || err.message));
    }
  };

  const COLORS = { cyan: { bg: "bg-cyan-500", hover: "hover:bg-cyan-400", base: "#06b6d4" }, green: { bg: "bg-green-500", hover: "hover:bg-green-400", base: "#22c55e" }, purple: { bg: "bg-purple-500", hover: "hover:bg-purple-400", base: "#a855f7" }, orange: { bg: "bg-orange-500", hover: "hover:bg-orange-400", base: "#f97316" }, pink: { bg: "bg-pink-500", hover: "hover:bg-pink-400", base: "#ec4899" } };

  const showConfirm = (message) => {
    return new Promise(resolve => {
      setConfirmDialog({ message, resolve });
    });
  };

  const renderTeamPage = () => (
    <div className="space-y-6">
      {team.map(c => (
        <div key={c.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-4" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>{c.label}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <MemberCard committeeId={c.id} role="head" data={{ id: c.headId, name: c.headName, imageUrl: c.headImage }} editTeamName={editTeamName} setEditTeamName={setEditTeamName} onSave={handleSave} onDeleteImage={handleDeleteImage} />
            {c.id !== "chairman" && <MemberCard committeeId={c.id} role="vice" data={{ id: c.viceId, name: c.viceName, imageUrl: c.viceImage }} editTeamName={editTeamName} setEditTeamName={setEditTeamName} onSave={handleSave} onDeleteImage={handleDeleteImage} />}
            {c.id === "oc" && <>
              <MemberCard committeeId={c.id} role="leader1" data={{ id: c.leader1Id, name: c.leader1Name, imageUrl: c.leader1Image }} editTeamName={editTeamName} setEditTeamName={setEditTeamName} onSave={handleSave} onDeleteImage={handleDeleteImage} />
              <MemberCard committeeId={c.id} role="leader2" data={{ id: c.leader2Id, name: c.leader2Name, imageUrl: c.leader2Image }} editTeamName={editTeamName} setEditTeamName={setEditTeamName} onSave={handleSave} onDeleteImage={handleDeleteImage} />
            </>}
            {(c.id === "hr" || c.id === "logistics") && (
              <MemberCard committeeId={c.id} role="leader" data={{ id: c.leaderId, name: c.leaderName, imageUrl: c.leaderImage }} editTeamName={editTeamName} setEditTeamName={setEditTeamName} onSave={handleSave} onDeleteImage={handleDeleteImage} />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const NavItem = ({ label, icon, pageKey }) => (
    <button onClick={() => setActivePage(pageKey)} className={`flex items-center gap-3 px-4 py-2 rounded-xl transition ${activePage === pageKey ? `${COLORS[themeColor]?.bg || "bg-cyan-500"} text-black` : "hover:bg-white/10"}`}>
      {icon} {label}
    </button>
  );

  const StatsCard = ({ platform }) => (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl shadow hover:scale-105 transition flex flex-col items-center">
      <div className="text-4xl mb-2">{PLATFORM_ICONS[platform.platform]}</div>
      <h3 className="font-bold text-lg capitalize">{platform.platform}</h3>
      <a href={platform.link} target="_blank" rel="noreferrer" className="text-cyan-400 underline mt-2 inline-block text-sm">Visit</a>
    </div>
  );

  const DashboardPage = () => {
    const statCards = [
      { label: "Total Members", value: stats?.totalMembers ?? "—", icon: <Users size={24} />, color: "text-cyan-400" },
      { label: "Leaders", value: stats?.totalLeaders ?? "—", icon: <Award size={24} />, color: "text-yellow-400" },
      { label: "Admins", value: stats?.totalAdmins ?? "—", icon: <Settings size={24} />, color: "text-red-400" },
      { label: "Events", value: stats?.eventsCount ?? "—", icon: <Calendar size={24} />, color: "text-green-400" },
      { label: "Gallery Photos", value: stats?.galleryCount ?? "—", icon: <Image size={24} />, color: "text-purple-400" },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map((s, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl hover:scale-105 transition">
              <div className={`${s.color} mb-3`}>{s.icon}</div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {socialData.map(s => <StatsCard key={s.platform} platform={s} />)}
        </div>
      </div>
    );
  };

  const PostsPage = () => (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
        <h2 className="text-xl font-bold mb-4">{editPost ? "Edit Post" : "Add Post"}</h2>
        <div className="flex gap-2 flex-wrap">
          <input type="text" placeholder="Title" value={editPost ? editPost.title : newPost.title}
            onChange={e => editPost ? setEditPost({ ...editPost, title: e.target.value }) : setNewPost({ ...newPost, title: e.target.value })}
            className="bg-white/10 border border-white/20 p-2 rounded flex-1 text-white" />
          <select value={editPost ? editPost.platform : newPost.platform}
            onChange={e => editPost ? setEditPost({ ...editPost, platform: e.target.value }) : setNewPost({ ...newPost, platform: e.target.value })}
            className="bg-white/10 border border-white/20 p-2 rounded text-white [color-scheme:dark]">
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
          </select>
          <input type="date" value={editPost ? editPost.date?.slice?.(0, 10) || "" : newPost.date}
            onChange={e => editPost ? setEditPost({ ...editPost, date: e.target.value }) : setNewPost({ ...newPost, date: e.target.value })}
            className="bg-white/10 border border-white/20 p-2 rounded text-white" />
          <input type="number" placeholder="Likes" value={editPost ? editPost.likes : newPost.likes}
            onChange={e => editPost ? setEditPost({ ...editPost, likes: +e.target.value }) : setNewPost({ ...newPost, likes: +e.target.value })}
            className="bg-white/10 border border-white/20 p-2 rounded w-20 text-white" />
          <input type="number" placeholder="Shares" value={editPost ? editPost.shares : newPost.shares}
            onChange={e => editPost ? setEditPost({ ...editPost, shares: +e.target.value }) : setNewPost({ ...newPost, shares: +e.target.value })}
            className="bg-white/10 border border-white/20 p-2 rounded w-20 text-white" />
          <button onClick={editPost ? updatePost : addPost} className={`px-4 py-2 ${COLORS[themeColor]?.bg || "bg-cyan-500"} text-black rounded font-semibold`}>
            {editPost ? "Update" : "Add"}
          </button>
          {editPost && <button onClick={() => setEditPost(null)} className="px-4 py-2 bg-gray-500 rounded">Cancel</button>}
        </div>
      </div>
      <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
        <h2 className="text-xl font-bold mb-4">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-gray-500">No posts yet</p>
        ) : (
          <div className="space-y-2">
            {posts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-gray-400">{p.platform} • {p.date?.slice?.(0, 10) || "—"} • 👍 {p.likes} • 🔄 {p.shares}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditPost(p)} className="px-3 py-1 bg-yellow-500 text-black rounded text-sm">Edit</button>
                  <button onClick={() => deletePost(p.id)} className="px-3 py-1 bg-red-500 rounded text-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const SettingsPage = () => (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
      <h2 className="text-xl font-bold mb-4">Social Media Settings</h2>
      <p className="text-sm text-gray-400 mb-6">Update your social media links.</p>
      {Object.entries(editSettings).map(([platform, data]) => (
        <div key={platform} className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-lg font-semibold capitalize mb-3 flex items-center gap-2">
            {PLATFORM_ICONS[platform]} {platform}
          </h3>
          <div>
            <label className="text-xs text-gray-400">Link</label>
            <input type="url" value={data.link} onChange={e => setEditSettings({ ...editSettings, [platform]: { ...data, link: e.target.value } })}
              className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
          </div>
        </div>
      ))}
      <button onClick={saveSettings} className="flex items-center gap-2 px-6 py-3 bg-green-500 text-black rounded-xl font-semibold hover:bg-green-400 transition">
        <Save size={18} /> Save All Settings
      </button>
    </div>
  );

  const MembersPage = () => {
    const [members, setMembers] = useState([]);
    const [newMember, setNewMember] = useState({ name: "", email: "", role: "member", committee: "", department: "", tempPassword: "", academicNumber: "" });
    const [memberPhoto, setMemberPhoto] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [editMemberData, setEditMemberData] = useState({});
    const [memberSearch, setMemberSearch] = useState("");
    const [memberPage, setMemberPage] = useState(1);
    const MEMBERS_PER_PAGE = 10;

    const displayMembers = members.filter(m =>
      !memberSearch || (m.name || "").toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.academic_number || "").toLowerCase().includes(memberSearch.toLowerCase())
    );
    const memberPages = Math.ceil(displayMembers.length / MEMBERS_PER_PAGE);
    const paginatedMembers = displayMembers.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE);

    useEffect(() => {
      axios.get("/api/admin/members", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setMembers(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    }, []);

    const handleCreateMember = () => {
      axios.post("/api/admin/members", newMember, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const created = res.data;
          if (memberPhoto) {
            const fd = new FormData();
            fd.append("image", memberPhoto);
            axios.post(`/api/admin/members/upload/${created.id}`, fd, { headers: { Authorization: `Bearer ${token}` } })
              .then(() => {
                created.has_image = 1;
                setMembers([created, ...members]);
              })
              .catch(() => setMembers([created, ...members]));
          } else {
            setMembers([created, ...members]);
          }
          setNewMember({ name: "", email: "", role: "member", committee: "", department: "", tempPassword: "", academicNumber: "" });
          setMemberPhoto(null);
        })
        .catch(err => toast.error("Failed: " + (err.response?.data?.message || err.message)));
    };

    const handleUpdateMember = (id) => {
      axios.put(`/api/admin/members/${id}`, editMemberData, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setMembers(members.map(m => m.id === id ? { ...m, ...res.data } : m));
          setEditingMember(null);
          setEditMemberData({});
          toast.success("Member updated");
        })
        .catch(err => toast.error("Failed: " + (err.response?.data?.message || err.message)));
    };

    const handleDeleteMember = async (id) => {
      if (!await showConfirm("Are you sure you want to delete this member?")) return;
      axios.delete(`/api/admin/members/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(() => { setMembers(members.filter(m => m.id !== id)); toast.success("Member deleted"); })
        .catch(err => toast.error("Failed: " + (err.response?.data?.message || err.message)));
    };

    const toggleStatus = (id) => {
      axios.put(`/api/admin/members/${id}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setMembers(members.map(m => m.id === id ? { ...m, enabled: res.data.enabled } : m)))
        .catch(() => {});
    };

    const uploadMemberImage = (id, file) => {
      const fd = new FormData();
      fd.append("image", file);
      axios.post(`/api/admin/members/upload/${id}`, fd, { headers: { Authorization: `Bearer ${token}` } })
        .then(() => setMembers(members.map(m => m.id === id ? { ...m, has_image: 1 } : m)))
        .catch(() => {});
    };

    const removeMemberImage = (id) => {
      axios.delete(`/api/admin/members/image/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(() => setMembers(members.map(m => m.id === id ? { ...m, has_image: 0 } : m)))
        .catch(() => {});
    };

    const startEdit = (m) => {
      setEditingMember(m.id);
      setEditMemberData({ name: m.name, email: m.email, role: m.role, committee: m.committee || "", department: m.department, academicNumber: m.academic_number });
    };

    return (
      <div className="space-y-6">
        {isAdmin && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-4">Create New Member</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="text" placeholder="Name" value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                className="bg-white/10 border border-white/20 p-2 rounded text-white" />
              <input type="email" placeholder="Email" value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                className="bg-white/10 border border-white/20 p-2 rounded text-white" />
              <input type="text" placeholder="Department" value={newMember.department} onChange={e => setNewMember({ ...newMember, department: e.target.value })}
                className="bg-white/10 border border-white/20 p-2 rounded text-white" />
              <input type="text" placeholder="Academic Number" value={newMember.academicNumber} onChange={e => setNewMember({ ...newMember, academicNumber: e.target.value })}
                className="bg-white/10 border border-white/20 p-2 rounded text-white" />
              <input type="text" placeholder="Password" value={newMember.tempPassword} onChange={e => setNewMember({ ...newMember, tempPassword: e.target.value })}
                className="bg-white/10 border border-white/20 p-2 rounded text-white" />
              <select value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value, committee: e.target.value !== "leader" ? "" : newMember.committee })}
                className="bg-white/10 border border-white/20 p-2 rounded text-white [color-scheme:dark]">
                <option value="member">Member</option>
                <option value="leader">Leader</option>
                <option value="admin">Admin</option>
              </select>
              {newMember.role === "leader" && (
                <select value={newMember.committee} onChange={e => setNewMember({ ...newMember, committee: e.target.value })}
                  className="bg-white/10 border border-white/20 p-2 rounded text-white [color-scheme:dark]">
                  <option value="">Select Committee</option>
                  {COMMITTEE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              )}
              <div className="sm:col-span-2 flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2 bg-white/10 border border-white/20 rounded text-white text-sm hover:bg-white/20 transition">
                  {memberPhoto ? memberPhoto.name : "Choose Photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setMemberPhoto(e.target.files[0]); }} />
                </label>
                {memberPhoto && (
                  <button onClick={() => setMemberPhoto(null)} className="text-xs text-red-400 hover:underline">Remove</button>
                )}
              </div>
            </div>
            <button onClick={handleCreateMember} className={`px-4 py-2 ${COLORS[themeColor]?.bg || "bg-cyan-500"} text-black rounded font-semibold mt-2`}>Create</button>
          </div>
        )}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl overflow-x-auto">
          <h2 className="text-xl font-bold mb-4">All Members</h2>
          <input type="text" placeholder="Search members by name, email, or ID..." value={memberSearch}
            onChange={e => { setMemberSearch(e.target.value); setMemberPage(1); }}
            className="input-premium mb-4 max-w-md" />
          {displayMembers.length === 0 ? (
            <p className="text-gray-500 text-sm">{memberSearch ? "No members match your search." : "No members found."}</p>
          ) : (
          <>
          <table className="min-w-full border border-white/20">
            <thead><tr className="bg-white/10">
              <th className="p-2">Photo</th><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Academic #</th>
              <th className="p-2">Role</th><th className="p-2">Committee</th><th className="p-2">Dept</th><th className="p-2">Status</th><th className="p-2">Actions</th>
            </tr></thead>
            <tbody>
              {paginatedMembers.map(m => (
                <tr key={m.id} className="border-t border-white/10">
                  <td className="p-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                      {m.has_image ? (
                        <img src={`/uploads/members/member-${m.id}.png`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="text-gray-500" />
                      )}
                    </div>
                  </td>
                  {editingMember === m.id ? (
                    <>
                      <td className="p-2"><input value={editMemberData.name} onChange={e => setEditMemberData({ ...editMemberData, name: e.target.value })} className="bg-white/10 border border-white/20 p-1 rounded text-white text-xs w-full" /></td>
                      <td className="p-2"><input value={editMemberData.email} onChange={e => setEditMemberData({ ...editMemberData, email: e.target.value })} className="bg-white/10 border border-white/20 p-1 rounded text-white text-xs w-full" /></td>
                      <td className="p-2"><input value={editMemberData.academicNumber} onChange={e => setEditMemberData({ ...editMemberData, academicNumber: e.target.value })} className="bg-white/10 border border-white/20 p-1 rounded text-white text-xs w-full" /></td>
                      <td className="p-2">
                        <select value={editMemberData.role} onChange={e => setEditMemberData({ ...editMemberData, role: e.target.value, committee: e.target.value !== "leader" ? "" : editMemberData.committee })} className="bg-white/10 border border-white/20 p-1 rounded text-white text-xs [color-scheme:dark]">
                          <option value="member">Member</option>
                          <option value="leader">Leader</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {editMemberData.role === "leader" ? (
                          <select value={editMemberData.committee} onChange={e => setEditMemberData({ ...editMemberData, committee: e.target.value })} className="bg-white/10 border border-white/20 p-1 rounded text-white text-xs [color-scheme:dark]">
                            <option value="">Select</option>
                            {COMMITTEE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-500">—</span>}
                      </td>
                      <td className="p-2"><input value={editMemberData.department} onChange={e => setEditMemberData({ ...editMemberData, department: e.target.value })} className="bg-white/10 border border-white/20 p-1 rounded text-white text-xs w-full" /></td>
                      <td className="p-2">{m.enabled ? "Active" : "Disabled"}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleUpdateMember(m.id)} className="px-2 py-1 bg-green-500/20 rounded text-green-400 text-xs">Save</button>
                          <button onClick={() => setEditingMember(null)} className="px-2 py-1 bg-gray-500/20 rounded text-gray-400 text-xs">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2">{m.name}</td>
                      <td className="p-2">{m.email}</td>
                      <td className="p-2">{m.academic_number}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${m.role === "admin" ? "bg-red-500/20 text-red-400" : m.role === "leader" ? "bg-yellow-500/20 text-yellow-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="p-2">{m.committee ? COMMITTEE_OPTIONS.find(c => c.value === m.committee)?.label || m.committee : "—"}</td>
                      <td className="p-2">{m.department}</td>
                      <td className="p-2">{m.enabled ? "Active" : "Disabled"}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          {isAdmin && (
                            <button onClick={() => startEdit(m)} className="p-1 bg-yellow-500/20 rounded hover:bg-yellow-500/40 transition">
                              <Settings size={14} className="text-yellow-400" />
                            </button>
                          )}
                          {isAdmin && (
                            <label className="cursor-pointer p-1 bg-cyan-500/20 rounded hover:bg-cyan-500/40 transition">
                              <Upload size={14} className="text-cyan-400" />
                              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadMemberImage(m.id, e.target.files[0]); }} />
                            </label>
                          )}
                          {isAdmin && m.has_image ? (
                            <button onClick={() => removeMemberImage(m.id)} className="p-1 bg-red-500/20 rounded hover:bg-red-500/40 transition">
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          ) : null}
                          {isAdmin && (
                            <>
                              <button onClick={() => toggleStatus(m.id)} className={`px-2 py-1 rounded text-white text-xs ${m.enabled ? "bg-red-500" : "bg-green-500"}`}>
                                {m.enabled ? "Disable" : "Enable"}
                              </button>
                              <button onClick={() => handleDeleteMember(m.id)} className="p-1 bg-red-500/20 rounded hover:bg-red-500/40 transition">
                                <Trash2 size={14} className="text-red-400" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {memberPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-400">
                Showing {(memberPage - 1) * MEMBERS_PER_PAGE + 1}–{Math.min(memberPage * MEMBERS_PER_PAGE, displayMembers.length)} of {displayMembers.length}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setMemberPage(p => Math.max(1, p - 1))} disabled={memberPage === 1} className="btn-secondary btn-sm">Prev</button>
                <span className="text-sm text-gray-400 px-3 py-1">{memberPage} / {memberPages}</span>
                <button onClick={() => setMemberPage(p => Math.min(memberPages, p + 1))} disabled={memberPage === memberPages} className="btn-secondary btn-sm">Next</button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    );
  };

  const QRPage = () => {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState("");
    const [qrValue, setQrValue] = useState("");
    const [eventCode, setEventCode] = useState("");
    const [generatedEvent, setGeneratedEvent] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState("");

    useEffect(() => {
      setEventsLoading(true);
      setEventsError("");
      fetch("/api/events")
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch events");
          return res.json();
        })
        .then(data => setEvents(Array.isArray(data) ? data : []))
        .catch(err => setEventsError(err.message || "Failed to load events"))
        .finally(() => setEventsLoading(false));
    }, []);

    const generateQR = (eventId, isRegenerate = false) => {
      if (!eventId) return;
      setGenerating(true);
      const url = isRegenerate
        ? `/api/admin/events/${eventId}/generate-qr?regenerate=1`
        : `/api/admin/events/${eventId}/generate-qr`;
      axios.post(url, {}, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setQrValue(res.data.qrCode);
          setEventCode(res.data.eventCode);
          const ev = events.find(e => e.id.toString() === eventId.toString());
          setGeneratedEvent(ev);
        })
        .catch(() => toast.error("Failed to generate QR code"))
        .finally(() => setGenerating(false));
    };

    const handleSelect = (e) => {
      const val = e.target.value;
      setSelectedEvent(val);
      setQrValue("");
      setEventCode("");
      setGeneratedEvent(null);
      if (val) generateQR(val, false);
    };

    const downloadQR = () => {
      const canvas = document.querySelector("#qr-display canvas");
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `event-${eventCode || selectedEvent}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    return (
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
          <h2 className="text-xl font-bold mb-4">QR Code</h2>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Select Event</label>
            {eventsLoading ? (
              <div className="w-full p-3 rounded-lg bg-white/10 text-gray-400 border border-white/20 text-sm">Loading events...</div>
            ) : eventsError ? (
              <div className="w-full p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm">{eventsError}</div>
            ) : events.length === 0 ? (
              <div className="w-full p-3 rounded-lg bg-white/10 text-gray-500 border border-white/20 text-sm">No events available.</div>
            ) : (
              <select value={selectedEvent} onChange={handleSelect}
                className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20 [color-scheme:dark]">
                <option value="">-- Choose Event --</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title} — {ev.date?.slice?.(0, 10) || ev.date}</option>
                ))}
              </select>
            )}
          </div>

          {generating && (
            <div className="mt-6 text-center text-gray-400">Generating QR code...</div>
          )}

          {qrValue && generatedEvent && !generating && (
            <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-xl text-center" id="qr-display">
              <h3 className="text-lg font-semibold mb-3">{generatedEvent.title}</h3>

              <div className="inline-block p-4 bg-white rounded-xl mb-3">
                <QRCodeCanvas value={qrValue} size={220} />
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-1">Event Code</p>
                <p className="text-xl font-mono font-bold tracking-wider" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>
                  {eventCode}
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button onClick={downloadQR}
                  className="px-4 py-2 bg-green-500 text-black rounded-lg font-semibold hover:bg-green-400 transition text-sm">
                  Download PNG
                </button>
                <button onClick={() => generateQR(selectedEvent, true)}
                  className="px-4 py-2 bg-yellow-500 text-black rounded-lg font-semibold hover:bg-yellow-400 transition text-sm">
                  Regenerate
                </button>
                <button onClick={() => { navigator.clipboard.writeText(eventCode); toast.success("Event code copied!"); }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition text-sm">
                  Copy Code
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AttendancePage = () => {
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [records, setRecords] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [locEdit, setLocEdit] = useState({});
    const [deletingEventId, setDeletingEventId] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);
    const [eventEditForm, setEventEditForm] = useState({ title: "", date: "", latitude: "", longitude: "", radius: 100, attendance_points: 2 });
    const [editingRecord, setEditingRecord] = useState(null);
    const [editForm, setEditForm] = useState({ inside_zone: null, timestamp: "" });
    const [deletingRecordId, setDeletingRecordId] = useState(null);

    const fetchEvents = async () => {
      try {
        const res = await axios.get("/api/admin/events", { headers: { Authorization: `Bearer ${token}` } });
        setEvents(Array.isArray(res.data) ? res.data : []);
      } catch {}
    };

    useEffect(() => { fetchEvents(); }, []);

    const viewAttendance = async (ev) => {
      setSelectedEvent(ev);
      setRecords([]);
      setRecordsLoading(true);
      try {
        const res = await axios.get(`/api/admin/events/${ev.id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
        setRecords(Array.isArray(res.data) ? res.data : []);
      } catch {}
      setRecordsLoading(false);
    };

    const deleteEvent = async (ev) => {
      if (!await showConfirm(`Delete event "${ev.title}" and all ${ev.attendanceCount} attendance records? Points will be reversed. This cannot be undone.`)) return;
      setDeletingEventId(ev.id);
      try {
        await axios.delete(`/api/admin/events/${ev.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setEvents(events.filter(e => e.id !== ev.id));
      } catch (err) {
        toast.error("Failed: " + (err.response?.data?.message || err.message));
      }
      setDeletingEventId(null);
    };

    const openEditRecord = (rec) => {
      setEditingRecord(rec);
      setEditForm({
        inside_zone: rec.insideZone === true ? "true" : rec.insideZone === false ? "false" : "null",
        timestamp: rec.timestamp ? new Date(rec.timestamp).toISOString().slice(0, 16) : "",
      });
    };

    const saveEditRecord = async () => {
      if (!editingRecord) return;
      try {
        const payload = {};
        payload.inside_zone = editForm.inside_zone === "true" ? true : editForm.inside_zone === "false" ? false : null;
        if (editForm.timestamp) payload.timestamp = new Date(editForm.timestamp).toISOString();
        await axios.put(`/api/admin/attendance/${editingRecord.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setRecords(records.map(r => r.id === editingRecord.id ? { ...r, insideZone: payload.inside_zone, timestamp: payload.timestamp || r.timestamp } : r));
        setEditingRecord(null);
        toast.success("Record updated");
      } catch (err) {
        toast.error("Failed: " + (err.response?.data?.message || err.message));
      }
    };

    const deleteAttendanceRecord = async (rec) => {
      if (!await showConfirm(`Delete attendance for ${rec.memberName}? Their attendance points will be reversed.`)) return;
      setDeletingRecordId(rec.id);
      try {
        await axios.delete(`/api/admin/attendance/${rec.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setRecords(records.filter(r => r.id !== rec.id));
        toast.success("Record deleted");
      } catch (err) {
        toast.error("Failed: " + (err.response?.data?.message || err.message));
      }
      setDeletingRecordId(null);
    };

    const openEventEdit = (ev) => {
      setEditingEvent(ev);
      setEventEditForm({
        title: ev.title || "",
        date: ev.date ? ev.date.slice(0, 10) : "",
        latitude: ev.latitude ?? "",
        longitude: ev.longitude ?? "",
        radius: ev.radius ?? 100,
        attendance_points: ev.attendance_points ?? 2,
      });
    };

    const saveEventEdit = async () => {
      if (!editingEvent) return;
      try {
        const res = await axios.put(`/api/admin/events/${editingEvent.id}`, {
          title: eventEditForm.title,
          date: eventEditForm.date || null,
          latitude: eventEditForm.latitude,
          longitude: eventEditForm.longitude,
          radius: parseInt(eventEditForm.radius) || 100,
          attendance_points: parseInt(eventEditForm.attendance_points) || 0,
        }, { headers: { Authorization: `Bearer ${token}` } });
        setEvents(events.map(e => e.id === editingEvent.id ? { ...e, ...res.data, attendanceCount: e.attendanceCount } : e));
        setEditingEvent(null);
        if (selectedEvent && selectedEvent.id === editingEvent.id) {
          setSelectedEvent({ ...selectedEvent, ...res.data });
        }
        toast.success("Event updated");
      } catch (err) {
        toast.error("Failed: " + (err.response?.data?.message || err.message));
      }
    };

    const exportEventExcel = async (ev) => {
      try {
        const res = await axios.get(`/api/admin/events/${ev.id}/attendance`, { headers: { Authorization: `Bearer ${token}` } });
        const rows = Array.isArray(res.data) ? res.data : [];

        const dateStr = new Date().toLocaleDateString("en-GB");
        const headers = ["Academic ID", "Full Name", "Department", "Role", "Event", "In Zone", "Date", "Time", "Location"];
        const data = [];
        data.push(["MT Club - Attendance Report"]);
        data.push([`Event: ${ev.title}`]);
        data.push([`Exported: ${dateStr}  |  Total: ${rows.length} records`]);
        data.push([]);
        data.push(headers);

        rows.forEach(a => {
          const d = new Date(a.timestamp);
          const zoneVal = a.insideZone === true ? "YES" : a.insideZone === false ? "NO" : "N/A";
          data.push([
            a.academicNumber || "",
            a.memberName || "",
            a.department || "",
            a.memberRole || "",
            ev.title || "",
            zoneVal,
            d.toLocaleDateString("en-GB"),
            d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
            a.location || "",
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);

        ws["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
          { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
        ];
        ws["!freeze"] = { xSplit: 0, ySplit: 5 };

        const colWidths = headers.map((_, ci) => {
          const maxLen = data.slice(4).reduce((max, row) => Math.max(max, String(row[ci] || "").length), headers[ci].length);
          return { wch: Math.min(maxLen + 3, 40) };
        });
        ws["!cols"] = colWidths;

        const thinBorder = { top: { style: "thin", color: { rgb: "CCCCCC" } }, bottom: { style: "thin", color: { rgb: "CCCCCC" } }, left: { style: "thin", color: { rgb: "CCCCCC" } }, right: { style: "thin", color: { rgb: "CCCCCC" } } };
        const headerBg = { rgb: "0D9488" };

        for (let r = 0; r < data.length; r++) {
          for (let c = 0; c < headers.length; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) continue;

            if (r === 0) {
              ws[addr].s = { font: { bold: true, sz: 16, color: { rgb: "0D9488" } }, alignment: { horizontal: "center" } };
            } else if (r === 1 || r === 2) {
              ws[addr].s = { font: { sz: 10, color: { rgb: "666666" } }, alignment: { horizontal: "center" } };
            } else if (r === 4) {
              ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: headerBg }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
            } else if (r > 4) {
              const isAcademicId = c === 0;
              const isZoneCol = c === 5;
              const cellStyle = {
                border: thinBorder,
                alignment: { horizontal: c <= 1 ? "left" : "center", vertical: "center" },
                numFmt: isAcademicId ? "@" : undefined,
              };
              if (isZoneCol) {
                const v = String(ws[addr].v || "").toUpperCase();
                if (v === "YES") {
                  cellStyle.font = { bold: true, color: { rgb: "16A34A" } };
                  cellStyle.fill = { fgColor: { rgb: "DCFCE7" } };
                } else if (v === "NO") {
                  cellStyle.font = { bold: true, color: { rgb: "DC2626" } };
                  cellStyle.fill = { fgColor: { rgb: "FEE2E2" } };
                }
              }
              ws[addr].s = cellStyle;
              if (isAcademicId && typeof ws[addr].v === "number") {
                ws[addr].t = "s";
                ws[addr].v = String(ws[addr].v);
              }
            }
          }
        }

        const wb = XLSX.utils.book_new();
        const rawName = `${ev.title} Attendance`.replace(/[\\/?*[\]:]/g, "").trim();
        const sheetName = rawName.length > 31 ? rawName.slice(0, 31) : rawName;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${ev.title.replace(/\s+/g, "_")}_attendance.xlsx`);
        toast.success("Excel exported successfully");
      } catch (err) {
        toast.error("Failed to export: " + (err.response?.data?.message || err.message));
      }
    };

    const saveLocation = async (evId) => {
      const loc = locEdit[evId] || {};
      try {
        await axios.put(`/api/admin/events/${evId}/location`, {
          latitude: parseFloat(loc.latitude) || null,
          longitude: parseFloat(loc.longitude) || null,
          radius: parseInt(loc.radius) || 100,
          attendance_points: loc.attendance_points !== undefined ? parseInt(loc.attendance_points) : undefined,
        }, { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Location saved!");
        fetchEvents();
      } catch (err) {
        toast.error("Failed: " + (err.response?.data?.message || err.message));
      }
    };

    return (
      <div className="space-y-6">
        {editingEvent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>Edit Event</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Event Title</label>
                  <input type="text" value={eventEditForm.title}
                    onChange={e => setEventEditForm({ ...eventEditForm, title: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Date</label>
                  <input type="date" value={eventEditForm.date}
                    onChange={e => setEventEditForm({ ...eventEditForm, date: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Latitude</label>
                    <input type="number" step="any" value={eventEditForm.latitude}
                      onChange={e => setEventEditForm({ ...eventEditForm, latitude: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Longitude</label>
                    <input type="number" step="any" value={eventEditForm.longitude}
                      onChange={e => setEventEditForm({ ...eventEditForm, longitude: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Radius (m)</label>
                    <input type="number" min="0" value={eventEditForm.radius}
                      onChange={e => setEventEditForm({ ...eventEditForm, radius: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Attendance Points</label>
                    <input type="number" min="0" value={eventEditForm.attendance_points}
                      onChange={e => setEventEditForm({ ...eventEditForm, attendance_points: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setEditingEvent(null)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">Cancel</button>
                <button onClick={saveEventEdit} className="px-4 py-2 bg-green-500 text-black rounded text-sm font-semibold hover:bg-green-400">Save</button>
              </div>
            </div>
          </div>
        )}

        {editingRecord && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/20 rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>Edit Attendance</h3>
              <p className="text-sm text-gray-400">{editingRecord.memberName}</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">In Zone</label>
                  <select value={editForm.inside_zone}
                    onChange={e => setEditForm({ ...editForm, inside_zone: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm [color-scheme:dark]">
                    <option value="null">Unknown</option>
                    <option value="true">Yes (In Zone)</option>
                    <option value="false">No (Out of Zone)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Check-in Time</label>
                  <input type="datetime-local" value={editForm.timestamp}
                    onChange={e => setEditForm({ ...editForm, timestamp: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setEditingRecord(null)} className="px-4 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-500">Cancel</button>
                <button onClick={saveEditRecord} className="px-4 py-2 bg-green-500 text-black rounded text-sm font-semibold hover:bg-green-400">Save</button>
              </div>
            </div>
          </div>
        )}

        {selectedEvent ? (
          <div className="space-y-4">
            <button onClick={() => { setSelectedEvent(null); setRecords([]); }} className="text-cyan-400 hover:underline text-sm">&larr; Back to events</button>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{selectedEvent.title} — Attendance</h2>
                <button onClick={() => exportEventExcel(selectedEvent)} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-black rounded font-semibold text-sm">
                  <Download size={14} /> Export Excel
                </button>
              </div>
              {recordsLoading ? (
                <p className="text-gray-400">Loading...</p>
              ) : records.length === 0 ? (
                <p className="text-gray-500 text-sm">No attendance records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="min-w-full border border-white/20">
                  <thead><tr className="bg-white/10">
                    <th className="p-2 text-left">Member</th><th className="p-2 text-left">Role</th><th className="p-2 text-left">In Zone</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Time</th><th className="p-2 text-left">Location</th><th className="p-2 text-left">Actions</th>
                  </tr></thead>
                  <tbody>
                    {records.map(a => (
                      <tr key={a.id} className="border-t border-white/10">
                        <td className="p-2">{a.memberName}</td>
                        <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${a.memberRole === "admin" ? "bg-cyan-500/20 text-cyan-400" : "bg-white/10 text-gray-400"}`}>{a.memberRole}</span></td>
                        <td className="p-2">
                          {a.insideZone === true ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">YES</span>
                          ) : a.insideZone === false ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">NO</span>
                          ) : (
                            <span className="text-xs text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-2">{new Date(a.timestamp).toLocaleDateString()}</td>
                        <td className="p-2">{new Date(a.timestamp).toLocaleTimeString()}</td>
                        <td className="p-2 text-xs text-gray-400">{a.location || "—"}</td>
                        <td className="p-2">
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditRecord(a)} className="px-2 py-1 bg-yellow-500/20 rounded text-yellow-400 text-xs font-semibold hover:bg-yellow-500/40 transition">
                                Edit
                              </button>
                              <button onClick={() => deleteAttendanceRecord(a)} disabled={deletingRecordId === a.id} className="px-2 py-1 bg-red-500/20 rounded text-red-400 text-xs font-semibold hover:bg-red-500/40 transition disabled:opacity-50">
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(ev => {
              const loc = locEdit[ev.id] || { latitude: ev.latitude || "", longitude: ev.longitude || "", radius: ev.radius || 100, attendance_points: ev.attendance_points ?? 2 };
              const hasLocation = ev.latitude != null && ev.longitude != null;
              return (
                <div key={ev.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>{ev.title}</h3>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEventEdit(ev)}
                          className="p-1.5 bg-yellow-500/20 rounded-lg hover:bg-yellow-500/40 transition">
                          <Pencil size={14} className="text-yellow-400" />
                        </button>
                        <button onClick={() => deleteEvent(ev)} disabled={deletingEventId === ev.id}
                          className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/40 transition disabled:opacity-50">
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{ev.date?.slice?.(0, 10) || "No date"}</p>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar size={14} />
                    <span>{ev.attendanceCount} attended</span>
                    {hasLocation && <><span className="mx-1">·</span><MapPin size={14} className="text-cyan-400" /><span>{ev.radius || 100}m radius</span></>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => viewAttendance(ev)} className="px-3 py-2 bg-white/10 rounded text-xs font-semibold hover:bg-white/20 transition">
                      View
                    </button>
                    <button onClick={() => exportEventExcel(ev)} className="px-3 py-2 bg-green-500/20 rounded text-xs font-semibold hover:bg-green-500/40 transition text-green-400">
                      Export
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-3 mt-1">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><MapPin size={12} /> Event Location</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" step="any" placeholder="Latitude" value={loc.latitude}
                        onChange={e => setLocEdit({ ...locEdit, [ev.id]: { ...loc, latitude: e.target.value } })}
                        className="bg-white/5 border border-white/10 p-1.5 rounded text-white text-xs" />
                      <input type="number" step="any" placeholder="Longitude" value={loc.longitude}
                        onChange={e => setLocEdit({ ...locEdit, [ev.id]: { ...loc, longitude: e.target.value } })}
                        className="bg-white/5 border border-white/10 p-1.5 rounded text-white text-xs" />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input type="number" placeholder="Radius (m)" value={loc.radius}
                        onChange={e => setLocEdit({ ...locEdit, [ev.id]: { ...loc, radius: e.target.value } })}
                        className="flex-1 bg-white/5 border border-white/10 p-1.5 rounded text-white text-xs" />
                      <input type="number" min="0" placeholder="Points" value={loc.attendance_points ?? ev.attendance_points ?? 2}
                        onChange={e => setLocEdit({ ...locEdit, [ev.id]: { ...loc, attendance_points: e.target.value } })}
                        className="w-20 bg-white/5 border border-white/10 p-1.5 rounded text-white text-xs" />
                      <button onClick={() => saveLocation(ev.id)} className="px-3 py-1.5 bg-cyan-500 text-black rounded text-xs font-semibold hover:bg-cyan-400 transition">
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const PointsPage = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userHistory, setUserHistory] = useState({ balance: 0, history: [] });
    const [historyLoading, setHistoryLoading] = useState(false);
    const [adjustForm, setAdjustForm] = useState({ points: "", transaction_type: "bonus", reason: "" });
    const [adjusting, setAdjusting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
      fetchLeaderboard();
    }, []);

    const fetchLeaderboard = () => {
      axios.get("/api/admin/points/leaderboard", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setLeaderboard(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    };

    const fetchUserHistory = (u) => {
      setSelectedUser(u);
      setHistoryLoading(true);
      setUserHistory({ balance: 0, history: [] });
      axios.get(`/api/admin/users/${u.id}/points`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUserHistory(res.data || { balance: 0, history: [] }))
        .catch(() => {})
        .finally(() => setHistoryLoading(false));
    };

    const adjustPoints = () => {
      if (!selectedUser || !adjustForm.points || !adjustForm.reason.trim()) return;
      setAdjusting(true);
      axios.post(`/api/admin/users/${selectedUser.id}/points`, {
        points: parseInt(adjustForm.points),
        transaction_type: adjustForm.transaction_type,
        reason: adjustForm.reason.trim(),
      }, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setUserHistory(prev => ({
            balance: res.data.balance,
            history: [
              {
                id: res.data.id,
                points: adjustForm.transaction_type === "penalty" ? -Math.abs(parseInt(adjustForm.points)) : Math.abs(parseInt(adjustForm.points)),
                transaction_type: adjustForm.transaction_type,
                reason: adjustForm.reason.trim(),
                created_at: new Date().toISOString(),
                eventTitle: null,
                createdByName: user?.name || "Admin",
              },
              ...prev.history,
            ],
          }));
          setLeaderboard(prev => prev.map(u => u.id === selectedUser.id ? { ...u, points: res.data.balance } : u));
          setAdjustForm({ points: "", transaction_type: "bonus", reason: "" });
        })
        .catch(err => toast.error("Failed: " + (err.response?.data?.message || err.message)))
        .finally(() => setAdjusting(false));
    };

    const filteredLeaderboard = leaderboard.filter(u => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (u.name || "").toLowerCase().includes(q) || (u.academic_number || "").toLowerCase().includes(q) || (u.role || "").toLowerCase().includes(q);
    });

    return (
      <div className="space-y-6">
        {selectedUser ? (
          <div className="space-y-4">
            <button onClick={() => setSelectedUser(null)} className="text-cyan-400 hover:underline text-sm">&larr; Back to leaderboard</button>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedUser.name}</h2>
                  <p className="text-sm text-gray-400">Balance: <span className="text-white font-bold">{userHistory.balance}</span> <Star size={14} className="text-yellow-400 fill-yellow-400 inline" /> points</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${selectedUser.role === "admin" ? "bg-red-500/20 text-red-400" : selectedUser.role === "leader" ? "bg-yellow-500/20 text-yellow-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                  {selectedUser.role}
                </span>
              </div>

              {isAdmin && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-4">
                  <h3 className="text-sm font-semibold mb-3">Adjust Points</h3>
                  <div className="flex gap-2 flex-wrap">
                    <input type="number" placeholder="Points" value={adjustForm.points}
                      onChange={e => setAdjustForm({ ...adjustForm, points: e.target.value })}
                      className="bg-white/10 border border-white/20 p-2 rounded text-white text-sm w-24" />
                    <select value={adjustForm.transaction_type}
                      onChange={e => setAdjustForm({ ...adjustForm, transaction_type: e.target.value })}
                      className="bg-white/10 border border-white/20 p-2 rounded text-white text-sm [color-scheme:dark]">
                      <option value="bonus">Bonus (+)</option>
                      <option value="penalty">Penalty (-)</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                    <input type="text" placeholder="Reason (required)" value={adjustForm.reason}
                      onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                      className="flex-1 bg-white/10 border border-white/20 p-2 rounded text-white text-sm" />
                    <button onClick={adjustPoints} disabled={adjusting || !adjustForm.points || !adjustForm.reason.trim()}
                      className={`px-4 py-2 ${COLORS[themeColor]?.bg || "bg-cyan-500"} text-black rounded font-semibold text-sm disabled:opacity-50`}>
                      {adjusting ? "Saving..." : "Submit"}
                    </button>
                  </div>
                </div>
              )}

              <h3 className="text-sm font-semibold mb-2 text-gray-400">Transaction History</h3>
              {historyLoading ? (
                <p className="text-gray-400 text-sm">Loading...</p>
              ) : userHistory.history.length === 0 ? (
                <p className="text-gray-500 text-sm">No transactions yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {userHistory.history.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${t.points > 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.points > 0 ? "+" : ""}{t.points} <Star size={12} className="text-yellow-400 fill-yellow-400 inline" />
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${t.transaction_type === "attendance" ? "bg-cyan-500/20 text-cyan-400" : t.transaction_type === "bonus" ? "bg-green-500/20 text-green-400" : t.transaction_type === "penalty" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {t.transaction_type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{t.reason}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(t.created_at).toLocaleString()}
                          {t.eventTitle && ` • ${t.eventTitle}`}
                          {t.createdByName && ` • by ${t.createdByName}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Points Leaderboard</h2>
              <div className="relative w-full sm:w-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by name, ID, or role..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm w-full sm:w-64" />
              </div>
            </div>
            {filteredLeaderboard.length === 0 ? (
              <p className="text-gray-500 text-sm">{searchQuery ? "No users match your search." : "No users found."}</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredLeaderboard.map((u, i) => (
                  <div key={u.id} onClick={() => fetchUserHistory(u)}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500 w-6 text-center">#{i + 1}</span>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                        {u.has_image ? (
                          <img src={`/uploads/members/member-${u.id}.png`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={14} className="text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.role} {u.academic_number ? `• ${u.academic_number}` : ""} {u.attendanceCount ? `• ${u.attendanceCount} events` : ""}</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold flex items-center gap-1" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>
                      {u.points} <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const NotificationsPage = () => {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [subtitle, setSubtitle] = useState("");
    const [target, setTarget] = useState("all");
    const [targetValue, setTargetValue] = useState("");
    const [importance, setImportance] = useState("default");
    const [channel, setChannel] = useState("general");
    const [deepLink, setDeepLink] = useState("");
    const [image, setImage] = useState("");
    const [largeIcon, setLargeIcon] = useState("");
    const [schedule, setSchedule] = useState("");
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState("send");
    const [members, setMembers] = useState([]);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
      if (activeTab === "history") loadHistory();
      if (activeTab === "stats") loadStats();
      if (activeTab === "send" && members.length === 0) loadMembers();
    }, [activeTab, historyPage]);

    const loadMembers = async () => {
      try {
        const res = await axios.get("/api/team", { headers: { Authorization: `Bearer ${user.token}` } });
        setMembers(res.data || []);
      } catch {}
    };

    const loadHistory = async () => {
      try {
        const res = await axios.get(`/api/notifications/history?page=${historyPage}&limit=20`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setHistory(res.data?.data || []);
        setHistoryTotal(res.data?.total || 0);
      } catch {}
    };

    const loadStats = async () => {
      try {
        const res = await axios.get("/api/notifications/stats", {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setStats(res.data);
      } catch {}
    };

    const handleSend = async () => {
      if (!title.trim() || !body.trim()) return;
      setSending(true);
      setSendResult(null);
      try {
        const payload = {
          title: title.trim(),
          body: body.trim(),
          subtitle: subtitle.trim() || undefined,
          target,
          targetValue: target === "all" ? undefined : targetValue,
          importance,
          channel,
          deepLink: deepLink.trim() || undefined,
          image: image.trim() || undefined,
          largeIcon: largeIcon.trim() || undefined,
          schedule: schedule || undefined,
        };
        const res = await axios.post("/api/notifications/send", payload, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setSendResult(res.data);
        if (res.data?.errors === 0) {
          toast.success(`Notification sent to ${res.data.sent} device(s)!`);
        } else {
          toast.warning(`Sent with issues: ${res.data.error || "unknown"}`);
        }
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        setSendResult({ error: msg });
        toast.error(msg);
      } finally {
        setSending(false);
      }
    };

    const handleReset = () => {
      setTitle(""); setBody(""); setSubtitle(""); setTarget("all");
      setTargetValue(""); setImportance("default"); setChannel("general");
      setDeepLink(""); setImage(""); setLargeIcon(""); setSchedule("");
      setSendResult(null); setShowPreview(false);
    };

    const clearHistory = async () => {
      if (!await showConfirm("Are you sure you want to delete all notification history?")) return;
      try {
        const res = await axios.delete("/api/notifications/history", {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.data?.success) {
          setHistory([]);
          setHistoryTotal(0);
          toast.success("Notification history cleared.");
        } else {
          toast.error(res.data?.message || "Failed to clear history");
        }
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || "Failed to clear history");
      }
    };

    const importanceOptions = [
      { value: "silent", label: "Silent", desc: "No sound, no vibration", color: "text-gray-400" },
      { value: "default", label: "Default", desc: "Normal behavior", color: "text-blue-400" },
      { value: "high", label: "High", desc: "Heads-up with sound & vibration", color: "text-orange-400" },
      { value: "urgent", label: "Urgent", desc: "Maximum priority, full screen", color: "text-red-400" },
    ];

    const channelOptions = [
      { value: "general", label: "General" },
      { value: "events", label: "Events" },
      { value: "attendance", label: "Attendance" },
      { value: "announcements", label: "Announcements" },
      { value: "emergency", label: "Emergency" },
    ];

    const committees = [
      { id: "hr", label: "HR" }, { id: "logistics", label: "Logistics" },
      { id: "tech", label: "Tech" }, { id: "pr", label: "PR" },
      { id: "oc", label: "OC" }, { id: "media", label: "Media" },
      { id: "firstaid", label: "First Aid" }, { id: "leadership", label: "Leadership" },
      { id: "chairman", label: "Chairman" },
    ];

    const inputClass = "w-full bg-white/10 border border-white/20 p-3 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition";
    const selectClass = `${inputClass} [color-scheme:dark]`;

    return (
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          {[
            { key: "send", icon: <Send size={14} />, label: "Composer" },
            { key: "history", icon: null, label: "History" },
            { key: "stats", icon: null, label: "Analytics" },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key ? `${COLORS[themeColor]?.bg || "bg-cyan-500"} text-black` : "bg-white/5 hover:bg-white/10"}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "send" && (
          <div className="space-y-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><Bell size={20} /> Notification Composer</h2>

              <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
                className={inputClass} />
              <input type="text" placeholder="Subtitle (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={100}
                className={inputClass} />
              <textarea placeholder="Message body..." value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000}
                className={`${inputClass} resize-none`} />
              <div className="text-right text-xs text-gray-500">{body.length}/1000</div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-4">
              <h3 className="font-semibold text-white/80">Target</h3>
              <select value={target} onChange={(e) => { setTarget(e.target.value); setTargetValue(""); }}
                className={selectClass}>
                <option value="all">Everyone</option>
                <option value="committee">Committee</option>
                <option value="user">Specific Member</option>
                <option value="multiple_users">Multiple Members (comma IDs)</option>
                <option value="external_id">External ID</option>
                <option value="segment">Segment</option>
              </select>
              {target === "committee" && (
                <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className={selectClass}>
                  <option value="">Select Committee</option>
                  {committees.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              {target === "user" && (
                <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className={selectClass}>
                  <option value="">Select Member</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name} (ID: {m.id})</option>)}
                </select>
              )}
              {target === "multiple_users" && (
                <input type="text" placeholder="User IDs (comma separated: 1,2,3)" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
                  className={inputClass} />
              )}
              {target === "external_id" && (
                <input type="text" placeholder="External ID" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
                  className={inputClass} />
              )}
              {target === "segment" && (
                <input type="text" placeholder="Segment name" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
                  className={inputClass} />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-3">
                <h3 className="font-semibold text-white/80">Importance</h3>
                {importanceOptions.map((opt) => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition border ${importance === opt.value ? "border-cyan-500/50 bg-white/10" : "border-transparent hover:bg-white/5"}`}>
                    <input type="radio" name="importance" value={opt.value} checked={importance === opt.value} onChange={() => setImportance(opt.value)}
                      className="accent-cyan-500" />
                    <div>
                      <span className={`font-medium ${opt.color}`}>{opt.label}</span>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl space-y-3">
                <h3 className="font-semibold text-white/80">Channel</h3>
                <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectClass}>
                  {channelOptions.map((ch) => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
                </select>
                <input type="text" placeholder="Deep Link (e.g. events/123)" value={deepLink} onChange={(e) => setDeepLink(e.target.value)}
                  className={inputClass} />
                <input type="text" placeholder="Image URL (optional)" value={image} onChange={(e) => setImage(e.target.value)}
                  className={inputClass} />
                <input type="text" placeholder="Large Icon URL (optional)" value={largeIcon} onChange={(e) => setLargeIcon(e.target.value)}
                  className={inputClass} />
                <input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`} />
                {schedule && <p className="text-xs text-yellow-400">Scheduled for {new Date(schedule).toLocaleString()}</p>}
              </div>
            </div>

            {showPreview && (
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                <h3 className="font-semibold text-white/80 mb-3">Preview</h3>
                <div className="bg-white/10 p-4 rounded-xl max-w-sm mx-auto">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center text-black font-bold text-sm">MT</div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">MT Club</p>
                      <p className="font-semibold text-sm">{title || "Title"}</p>
                      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
                      <p className="text-sm text-gray-300 mt-1">{body || "Body text"}</p>
                      {image && <img src={image} alt="" className="mt-2 rounded-lg max-h-32 w-full object-cover" />}
                    </div>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <span className={`text-xs px-2 py-1 rounded ${importance === "urgent" ? "bg-red-500/20 text-red-400" : importance === "high" ? "bg-orange-500/20 text-orange-400" : "bg-white/10 text-gray-400"}`}>
                    {importance.toUpperCase()} • {channel}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/15 transition text-sm">
                {showPreview ? "Hide Preview" : "Preview"}
              </button>
              <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition ${COLORS[themeColor]?.bg || "bg-cyan-500"} text-black disabled:opacity-40 disabled:cursor-not-allowed`}>
                {sending ? "Sending..." : schedule ? "Schedule Notification" : "Send Notification"}
              </button>
              <button onClick={handleReset}
                className="px-4 py-3 rounded-xl font-medium bg-white/10 hover:bg-white/15 transition text-sm">
                Reset
              </button>
            </div>

            {sendResult && (
              <div className={`p-4 rounded-xl border ${sendResult.error ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
                <p className="font-semibold">{sendResult.error ? "Send Failed" : "Send Result"}</p>
                {sendResult.sent !== undefined && <p className="text-sm mt-1">Delivered to {sendResult.sent} device(s)</p>}
                {sendResult.sent > 0 && <p className="text-xs text-gray-400 mt-1">{sendResult.sent} device(s) received</p>}
                {sendResult.error && <p className="text-sm text-red-400 mt-1">{sendResult.error}</p>}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Notification History</h2>
              {isAdmin && history.length > 0 && (
                <button onClick={clearHistory}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition">
                  🗑 Clear Notification History
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-gray-400">No notifications sent yet</p>
            ) : (
              <div className="space-y-3">
                {history.map((n) => (
                  <div key={n.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{n.title}</p>
                          {n.sent_count > 0 && <span className="text-xs px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">SENT</span>}
                          {n.error && <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">ERR</span>}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{n.body}</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-white/10 rounded">{n.target}</span>
                      {n.target_value && <span className="text-xs px-2 py-0.5 bg-white/10 rounded">{n.target_value}</span>}
                      {n.sent_count > 0 && <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">{n.sent_count} sent</span>}
                      {n.members?.name && <span className="text-xs px-2 py-0.5 bg-white/10 rounded">by {n.members.name}</span>}
                      {n.error && <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">{n.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {historyTotal > 20 && (
              <div className="flex justify-center gap-2 mt-4">
                <button onClick={() => setHistoryPage(Math.max(1, historyPage - 1))} disabled={historyPage === 1}
                  className="px-3 py-1 rounded bg-white/10 text-sm disabled:opacity-40">Prev</button>
                <span className="px-3 py-1 text-sm text-gray-400">Page {historyPage} of {Math.ceil(historyTotal / 20)}</span>
                <button onClick={() => setHistoryPage(historyPage + 1)} disabled={historyPage * 20 >= historyTotal}
                  className="px-3 py-1 rounded bg-white/10 text-sm disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Total Members", value: stats?.totalMembers },
                { label: "Members with Push", value: stats?.membersWithPush },
                { label: "Members without Push", value: stats?.membersWithoutPush },
                { label: "Notifications Sent", value: stats?.totalNotificationsSent },
                { label: "Total Delivered", value: stats?.totalDelivered },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl text-center">
                  <p className="text-3xl font-bold">{s.value ?? "—"}</p>
                  <p className="text-sm text-gray-400 mt-2">{s.label}</p>
                </div>
              ))}
            </div>
            {stats?.platforms && (
              <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
                <h3 className="font-semibold mb-3">Devices by Platform</h3>
                <div className="flex gap-4">
                  {Object.entries(stats.platforms).map(([p, count]) => (
                    <div key={p} className="text-center">
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm text-gray-400 capitalize">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPage = () => {
    if (loading) return <p className="text-gray-400">Loading...</p>;
    if (!isAdmin && ["posts", "settings", "qr", "notifications"].includes(activePage)) return <DashboardPage />;
    switch (activePage) {
      case "dashboard": return <DashboardPage />;
      case "posts": return <PostsPage />;
      case "settings": return <SettingsPage />;
      case "team": return renderTeamPage();
      case "members": return <MembersPage />;
      case "qr": return <QRPage />;
      case "attendance": return <AttendancePage />;
      case "points": return <PointsPage />;
      case "notifications": return <NotificationsPage />;
      default: return <DashboardPage />;
    }
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-bold" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>MT Club</h1>
        <button onClick={logout} className="text-red-400 text-sm">Logout</button>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto">
        <NavItem label="Dashboard" icon={<Users />} pageKey="dashboard" />
        <NavItem label="Members" icon={<UserPlus />} pageKey="members" />
        {isAdmin && <NavItem label="QR Codes" icon={<QrCode />} pageKey="qr" />}
        <NavItem label="Attendance" icon={<Calendar />} pageKey="attendance" />
        <NavItem label="Points" icon={<Award />} pageKey="points" />
        {isAdmin && <NavItem label="Posts" icon={<Plus />} pageKey="posts" />}
        {isAdmin && <NavItem label="Notifications" icon={<Bell />} pageKey="notifications" />}
        <NavItem label="Team" icon={<Image />} pageKey="team" />
        {isAdmin && <NavItem label="Settings" icon={<Settings />} pageKey="settings" />}
      </div>
      <div className="mt-auto">
        <select value={themeColor} onChange={e => setThemeColor(e.target.value)}
          className="w-full p-2 rounded bg-white/10 border border-white/20 text-white text-sm [color-scheme:dark]">
          {Object.keys(COLORS).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>
    </>
  );

  return (
    <div className="flex h-screen relative" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10" style={{ boxShadow: `0 0 900px 20px ${COLORS[themeColor]?.base || "#00ACC1"}` }}></div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 p-5 flex flex-col gap-6 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <div className="lg:hidden flex items-center gap-3 p-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-lg font-bold" style={{ color: COLORS[themeColor]?.base || "#06b6d4" }}>MT Club</h1>
          <button onClick={logout} className="ml-auto text-red-400 text-sm">Logout</button>
        </div>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <h1 className="text-2xl lg:text-3xl font-bold mb-6 capitalize" style={{ color: COLORS[themeColor]?.base || "#fff" }}>{activePage}</h1>
          {renderPage()}
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <p className="text-white text-sm leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { confirmDialog.resolve(false); setConfirmDialog(null); }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-500 transition">
                Cancel
              </button>
              <button onClick={() => { confirmDialog.resolve(true); setConfirmDialog(null); }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-400 transition">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}