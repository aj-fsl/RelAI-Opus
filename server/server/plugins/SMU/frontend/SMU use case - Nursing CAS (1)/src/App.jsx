import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ApplicationsTable from "./components/tables/ApplicationsTable";
import UploadSection from "./components/upload/UploadSection";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";



function App() {
  return (
    <Router>
      <Layout>
        <div className="dashboard-container">
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
            theme="light"
          />
          <Routes>
            <Route path="/" element={<ApplicationsTable />} />
            <Route path="/upload" element={<UploadSection />} />
          </Routes>
        </div>
      </Layout>
    </Router>
  );
}

export default App;
