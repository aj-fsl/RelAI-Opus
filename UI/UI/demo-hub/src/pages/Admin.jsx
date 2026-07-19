import { useState, useEffect } from "react";
import "../App.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export default function Admin() {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    owner: "",
    category: "",
    frontendZip: null,
    frontendUrl: "",
    backendZip: null,
    backendUrl: ""
  });

  const [loading, setLoading] = useState(false);
  const [demos, setDemos] = useState([]);
  const [editingDemo, setEditingDemo] = useState(null);

  useEffect(() => {
    fetchDemos();
  }, []);

  const fetchDemos = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/demos`);
      const data = await r.json();
      setDemos(data);
    } catch (err) {
      console.error("Failed to fetch demos", err);
    }
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({ ...prev, [name]: files[0] }));
  };

  const validate = () => {
    if (!formData.name.trim()) {
      alert("Demo name is required");
      return false;
    }
    if (!editingDemo) {
      if (!formData.frontendZip && !formData.frontendUrl.trim()) {
        alert("Provide Frontend ZIP or Frontend URL");
        return false;
      }
      if (!formData.backendZip && !formData.backendUrl.trim()) {
        alert("Provide Backend ZIP or Backend URL");
        return false;
      }
    }
    return true;
  };

  const upload = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const form = new FormData();
      form.append("name", formData.name);
      form.append("description", formData.description);
      form.append("owner", formData.owner);
      form.append("category", formData.category);

      let url, method;
      if (editingDemo) {
        url = `${API_BASE}/api/admin/edit-demo/${editingDemo.name}`;
        method = "PUT";
      } else {
        url = `${API_BASE}/api/admin/upload-demo`;
        method = "POST";
        if (formData.frontendZip) form.append("frontend_zip", formData.frontendZip);
        if (formData.frontendUrl) form.append("frontend_url", formData.frontendUrl);
        if (formData.backendZip) form.append("backend_zip", formData.backendZip);
        if (formData.backendUrl) form.append("backend_url", formData.backendUrl);
      }

      console.log(`[upload] ${method} ${url}`);
      console.log("[upload] FormData keys:", [...form.keys()]);

      const response = await fetch(url, { method, body: form });
      const body = await response.json().catch(() => null);

      console.log(`[upload] HTTP ${response.status}`, body);

      if (!response.ok) {
        const detail =
          body?.error ||
          body?.detail?.[0]?.msg ||
          (typeof body?.detail === "string" ? body.detail : null) ||
          response.statusText;
        const step = body?.step ? ` (step: ${body.step})` : "";
        const trace = body?.trace || "";
        console.error(`[upload] Server error${step}:`, detail, trace);
        alert(`Error ${response.status}${step}: ${detail}`);
        return;
      }

      if (body?.warnings?.length) {
        console.warn("[upload] Warnings:", body.warnings);
        alert(
          (editingDemo ? "Updated" : "Uploaded") +
            " with warnings:\n" +
            body.warnings.join("\n")
        );
      } else {
        alert(editingDemo ? "Updated Successfully" : "Uploaded Successfully");
      }

      cancelEdit();
      fetchDemos();

    } catch (err) {
      console.error("[upload] Network/fetch error:", err);
      alert(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteDemo = async (name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/delete-demo/${name}`, {
        method: "DELETE"
      });
      const body = await response.json().catch(() => null);
      console.log(`[delete] HTTP ${response.status}`, body);

      if (!response.ok) {
        const detail = body?.error || response.statusText;
        alert(`Delete failed (${response.status}): ${detail}`);
        return;
      }
      alert("Deleted Successfully");
      fetchDemos();
    } catch (err) {
      console.error("[delete] Network error:", err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const startEdit = (demo) => {
    setEditingDemo(demo);
    setFormData({
      name: demo.name,
      description: demo.description || "",
      owner: demo.owner || "",
      category: demo.category || "",
      frontendZip: null,
      frontendUrl: "",
      backendZip: null,
      backendUrl: ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingDemo(null);
    setFormData({
      name: "",
      description: "",
      owner: "",
      category: "",
      frontendZip: null,
      frontendUrl: "",
      backendZip: null,
      backendUrl: ""
    });
  };

  return (
    <div className="container" style={{ display: 'block', minHeight: 'auto' }}>
      <div className="form-card" style={{ margin: '0 auto 3rem auto' }}>
        <h2 style={{ marginBottom: "0.5rem" }}>{editingDemo ? "Edit Demo" : "Admin Dashboard"}</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
          {editingDemo ? `Editing: ${editingDemo.name}` : "Upload and manage demo entries for this template hub"}
        </p>

        <div className="form-group">
          <label>Demo Name</label>
          <input
            name="name"
            placeholder="e.g. Banking Assistant"
            value={formData.name}
            onChange={handleTextChange}
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            placeholder="What does this demo do?"
            value={formData.description}
            onChange={handleTextChange}
            className="form-control"
            rows="3"
            style={{ resize: "none" }}
          />
        </div>

        <div className="form-group">
          <label>Owner / Author</label>
          <input
            name="owner"
            placeholder="e.g. John Doe"
            value={formData.owner}
            onChange={handleTextChange}
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label>Category</label>
          <input
            name="category"
            placeholder="e.g. Finance, Operations, Customer Support"
            value={formData.category}
            onChange={handleTextChange}
            className="form-control"
          />
        </div>

        {!editingDemo && (
          <>
            <h3 className="section-title">Frontend Configuration</h3>
            <div className="form-group">
              <label>Frontend Build (ZIP)</label>
              <input
                type="file"
                name="frontendZip"
                accept=".zip"
                onChange={handleFileChange}
                className="form-control file-input"
              />
            </div>
            <div className="form-group">
              <label>OR Frontend URL</label>
              <input
                name="frontendUrl"
                placeholder="https://..."
                value={formData.frontendUrl}
                onChange={handleTextChange}
                className="form-control"
              />
            </div>

            <h3 className="section-title">Backend Configuration</h3>
            <div className="form-group">
              <label>Backend Package (ZIP)</label>
              <input
                type="file"
                name="backendZip"
                accept=".zip"
                onChange={handleFileChange}
                className="form-control file-input"
              />
            </div>
            <div className="form-group">
              <label>OR Backend URL</label>
              <input
                name="backendUrl"
                placeholder="http://..."
                value={formData.backendUrl}
                onChange={handleTextChange}
                className="form-control"
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={upload}
            disabled={loading}
            className="btn"
            style={{ marginTop: "1rem" }}
          >
            {loading ? "Processing..." : editingDemo ? "Update Demo" : "Publish Demo"}
          </button>
          {editingDemo && (
            <button
              onClick={cancelEdit}
              className="btn"
              style={{ marginTop: "1rem", backgroundColor: '#64748b' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
