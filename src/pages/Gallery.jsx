import Header from "../components/Header";
import { useState, useCallback, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useCachedData } from "../hooks/useCachedData";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import SkeletonLoader from "../components/SkeletonLoader";
import ImageViewer from "../components/ImageViewer";
import { ImagePlus } from "lucide-react";

export default function Gallery() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const token = user?.token || (() => { const s = localStorage.getItem("user"); return s ? JSON.parse(s).token : null })();

  const fetchGallery = useCallback(() =>
    fetch("/api/gallery").then((r) => r.json()).then((d) => (Array.isArray(d) ? d : [])),
    []
  );

  const { data: images, loading, fromCache, refresh } = useCachedData("gallery", fetchGallery);

  const filtered = (Array.isArray(images) ? images : []).filter(img =>
    !debouncedSearch || (img.filename || "").toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!token) return;
    try {
      await fetch(`/api/gallery/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      refresh();
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !token) return;
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (data.filename) {
        setShowAdd(false);
        setFile(null);
        setPreview("");
        refresh();
        toast.success("Image uploaded successfully");
      }
    } catch {
      toast.error("Failed to upload image");
    }
  };

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <section className="max-w-6xl mx-auto px-6 pt-32 pb-20">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 md:mb-12 text-center">Gallery</h1>

        {user?.role === "admin" && (
          <div className="text-center mb-6">
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2 mx-auto"
            >
              <ImagePlus size={18} />
              Add Image
            </button>
          </div>
        )}

        <input
          type="text"
          placeholder="Search gallery..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-premium mb-6 max-w-md mx-auto block"
        />

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {loading && !images ? (
            <div className="col-span-full">
              <SkeletonLoader type="page" />
            </div>
          ) : filtered.length === 0 && !loading ? (
            <div className="col-span-full">
              <EmptyState
                type="gallery"
                title={search ? "No matching images" : fromCache ? "No cached images" : "No images yet"}
                description={search ? "Try a different search term." : fromCache ? "Connect to the internet to load the gallery." : "Upload photos from events to build the gallery."}
              />
            </div>
          ) : (
            filtered.map((img) => {
              const idx = (Array.isArray(images) ? images : []).findIndex(i => i.id === img.id);
              return (
                <div
                  key={img.id}
                  className="relative overflow-hidden rounded-2xl cursor-pointer transform transition duration-500 hover:scale-110 hover:rotate-1 hover:shadow-lg hover:shadow-cyan-500/40 animate-fadeIn"
                  onClick={() => { setViewerIndex(idx >= 0 ? idx : 0); setViewerOpen(true); }}
                >
                  <img
                    src={img.filename}
                    alt={`Gallery ${img.id}`}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                  />
                  {user?.role === "admin" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                      className="absolute top-2 right-2 bg-red-600 p-2 min-w-[36px] min-h-[36px] rounded-full hover:bg-red-700 transition flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {viewerOpen && (
        <ImageViewer
          images={Array.isArray(images) ? images : []}
          currentIndex={viewerIndex}
          onClose={() => { setViewerOpen(false); setViewerIndex(0); }}
        />
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:p-8 w-full max-w-md mx-4 relative shadow-xl">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Add Image</h2>

            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full mb-4 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-cyan-500 file:text-black file:font-semibold file:cursor-pointer hover:file:bg-cyan-400"
            />

            {preview && (
              <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-xl mb-4" />
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowAdd(false); setFile(null); setPreview(""); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="btn-primary"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
