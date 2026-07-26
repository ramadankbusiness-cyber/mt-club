import { useState, useEffect, useContext, useRef } from "react";
import { Star, User, Shield, CalendarDays, Award, Camera } from "lucide-react";
import Header from "../components/Header";
import { AuthContext } from "../context/AuthContext";
import axios from "../utils/axios";
import { useToast } from "../components/Toast";

export default function Profile() {
  const { user, login } = useContext(AuthContext);
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwMsgType, setPwMsgType] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();
  const token = user?.token;

  useEffect(() => {
    if (!token) return;
    const fetchProfile = () => {
      axios.get("/api/auth/profile", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setProfile(res.data))
        .catch(() => {});
    };
    fetchProfile();
  }, [token]);

  const confirmImage = () => {
    if (!pendingImage) return;
    setUploading(true);
    const form = new FormData();
    form.append("image", pendingImage);
    axios.post("/api/auth/profile/image", form, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } })
      .then(res => {
        setProfile(prev => ({ ...prev, profile_image: res.data.profile_image }));
        login({ ...user, profile_image: res.data.profile_image });
        setPendingImage(null);
        toast.success("Photo updated");
      })
      .catch(() => toast.error("Failed to upload photo"))
      .finally(() => setUploading(false));
  };

  const changePassword = (e) => {
    e.preventDefault();
    setPwMsg("");
    if (newPassword !== confirmPassword) {
      setPwMsg("Passwords don't match");
      setPwMsgType("error");
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg("Password must be at least 6 characters");
      setPwMsgType("error");
      return;
    }
    axios.put("/api/auth/change-password", { oldPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(res => {
      setPwMsg(res.data.message);
      setPwMsgType("success");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Password changed");
    }).catch(err => {
      const msg = err.response?.data?.message || "Error";
      setPwMsg(msg);
      setPwMsgType("error");
      toast.error(msg);
    });
  };

  if (!user) {
    return (
      <main className="relative w-full min-h-screen overflow-y-auto">
        <Header />
        <div className="flex items-center justify-center h-[80vh]">
          <p className="text-gray-500 text-lg">Please sign in to view your profile</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen overflow-y-auto">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] fixed top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-20">
        <h1 className="text-4xl font-bold mb-8">Profile</h1>

        {(() => {
          let score = 0;
          if (profile?.name) score += 25;
          if (profile?.email) score += 25;
          if (profile?.profile_image) score += 25;
          if ((profile?.attendanceCount ?? 0) > 0) score += 25;
          return (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Profile Completion</span>
                <span className="text-sm font-semibold text-cyan-400">{score}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${score}%` }} />
              </div>
            </div>
          );
        })()}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl text-center">
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-white/10 mb-4 flex items-center justify-center">
                {pendingImage ? (
                  <img src={URL.createObjectURL(pendingImage)} alt="Preview" className="w-full h-full object-cover" />
                ) : profile?.profile_image ? (
                  <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-gray-500 font-bold">
                    {(profile?.name || user.name || "U")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden"
                onChange={e => { if (e.target.files?.[0]) setPendingImage(e.target.files[0]); }} />
              {pendingImage ? (
                <div className="flex gap-2 justify-center">
                  <button onClick={confirmImage} disabled={uploading}
                    className="btn-primary">
                    {uploading ? "Saving..." : "Save Photo"}
                  </button>
                  <button onClick={() => setPendingImage(null)}
                    className="btn-secondary">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="btn-primary w-full mt-4">
                  Change Photo
                </button>
              )}
              <p className="text-xs text-gray-500 mt-2">PNG, JPG</p>
              <p className="text-sm font-semibold mt-3 flex items-center justify-center gap-2">
                {profile?.name || user.name || "User"}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  (profile?.role || user.role) === "admin" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                  (profile?.role || user.role) === "leader" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                  "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                }`}>
                  {(profile?.role || user.role || "member")}
                </span>
              </p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-4">General Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Name</label>
                  <input type="text" value={profile?.name || ""} disabled
                    className="w-full bg-white/5 border border-white/10 p-2 rounded text-gray-400 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email</label>
                  <input type="email" value={profile?.email || user.email || ""} disabled
                    className="w-full bg-white/5 border border-white/10 p-2 rounded text-gray-400 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Role</label>
                  <input type="text" value={profile?.role || user.role || ""} disabled
                    className="w-full bg-white/5 border border-white/10 p-2 rounded text-gray-400 cursor-not-allowed capitalize" />
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-4">Profile Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <Shield size={20} className="text-cyan-400" />
                  <div>
                    <p className="text-xs text-gray-400">Role</p>
                    <p className="text-sm font-semibold capitalize">{profile?.role || user.role || "Member"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <CalendarDays size={20} className="text-green-400" />
                  <div>
                    <p className="text-xs text-gray-400">Joined</p>
                    <p className="text-sm font-semibold">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <Award size={20} className="text-yellow-400" />
                  <div>
                    <p className="text-xs text-gray-400">Points</p>
                    <p className="text-sm font-semibold">{profile?.points ?? 0} ★</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                  <Camera size={20} className="text-purple-400" />
                  <div>
                    <p className="text-xs text-gray-400">Events Attended</p>
                    <p className="text-sm font-semibold">{profile?.attendanceCount ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-2">Points</h2>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-bold text-cyan-400">{profile?.points ?? 0}</span>
                <Star size={36} className="text-yellow-400 fill-yellow-400" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Attended {profile?.attendanceCount ?? 0} event{(profile?.attendanceCount ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-4">Change Password</h2>
              {pwMsg && (
                <p className={`text-sm mb-3 p-2 rounded ${pwMsgType === "success" ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                  {pwMsg}
                </p>
              )}
              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Current Password</label>
                  <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required
                    className="input-premium" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                    className="input-premium" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                    className="input-premium" />
                </div>
                <button type="submit"
                  className="btn-danger w-full mt-2">
                  Change Password
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
