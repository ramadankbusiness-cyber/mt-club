import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import Header from "../components/Header";
import axios from "../utils/axios";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";

export default function AdminAccounts() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [newMember, setNewMember] = useState({
    name: "", email: "", role: "member", department: "", tempPassword: "", academicNumber: "",
  });

  useEffect(() => {
    if (!user?.token) return;
    axios
      .get("/api/admin/members", {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      .then((res) => setMembers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [user]);

  const handleCreateMember = () => {
    if (!newMember.name || !newMember.email) {
      toast.warning("Name and email are required");
      return;
    }
    axios
      .post("/api/admin/members", newMember, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      .then((res) => {
        setMembers([...members, res.data]);
        setNewMember({ name: "", email: "", role: "member", department: "", tempPassword: "", academicNumber: "" });
        toast.success("Member created successfully");
      })
      .catch(err => toast.error("Failed: " + (err.response?.data?.message || err.message)));
  };

  const toggleStatus = (id) => {
    axios
      .put(`/api/admin/members/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      .then((res) => {
        setMembers(members.map(m => m.id === id ? { ...m, enabled: res.data.enabled } : m));
        toast.success(res.data.enabled ? "Member enabled" : "Member disabled");
      })
      .catch(err => toast.error("Failed: " + (err.response?.data?.message || err.message)));
  };

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="p-8 pt-32 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Member Management</h2>

        <div className="mb-6 border border-white/20 p-4 rounded-xl bg-white/5">
          <h3 className="font-semibold mb-2">Create New Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} className="input-premium" />
            <input type="email" placeholder="Email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} className="input-premium" />
            <input type="text" placeholder="Department" value={newMember.department} onChange={(e) => setNewMember({ ...newMember, department: e.target.value })} className="input-premium" />
            <input type="text" placeholder="Academic Number" value={newMember.academicNumber} onChange={(e) => setNewMember({ ...newMember, academicNumber: e.target.value })} className="input-premium" />
            <input type="text" placeholder="Temporary Password" value={newMember.tempPassword} onChange={(e) => setNewMember({ ...newMember, tempPassword: e.target.value })} className="input-premium" />
            <select value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} className="input-premium [color-scheme:dark]">
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
          <button onClick={handleCreateMember} className="btn-primary mt-2">
            Create Member
          </button>
        </div>

        {members.length === 0 ? (
          <EmptyState type="team" title="No members yet" description="Create your first member using the form above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-white/20">
              <thead>
                <tr className="bg-white/10">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Academic #</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Department</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-white/10">
                    <td className="p-2">{m.name}</td>
                    <td className="p-2">{m.email}</td>
                    <td className="p-2">{m.academicNumber}</td>
                    <td className="p-2">{m.role}</td>
                    <td className="p-2">{m.department}</td>
                    <td className="p-2">{m.enabled ? "Active" : "Disabled"}</td>
                    <td className="p-2">
                      <button onClick={() => toggleStatus(m.id)} className={`btn-sm ${m.enabled ? "btn-danger" : "btn-primary"}`}>
                        {m.enabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
