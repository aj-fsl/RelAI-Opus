import React, { useEffect, useMemo, useState } from "react";
import { getJobsForDashboardApi } from "../../api/uploadApi";

const PROGRAMS = ["BSN", "ABSN", "ELMSN"];
const PAGE_SIZE = 10;

const parseDate = value => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const isValidEmailBody = value =>
  value && value !== "COULD_NOT_RUN";

const ApplicationsTable = () => {
  const [programFilter, setProgramFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [apiData, setApiData] = useState([]);
  const [emailModal, setEmailModal] = useState(null);

  useEffect(() => {
    fetchApiData();
  }, []);

  const fetchApiData = async () => {
    const jobs = await getJobsForDashboardApi();
    setApiData(jobs?.result || []);
  };

  /* ---- Normalize API data ---- */
  const data = useMemo(() => {
    return apiData.map((item, index) => {
      const program = item.workflow_output_npfmlabni;
      const status = item.workflow_output_5pztwchqa;

      // Pick whichever email body is valid
      const emailBody =
        isValidEmailBody(item.workflow_output_fsdkl4qsc)
          ? item.workflow_output_fsdkl4qsc
          : isValidEmailBody(item.workflow_output_6ukua728j)
          ? item.workflow_output_6ukua728j
          : null;

      const showEmail =
        program === "BSN" &&
        (status === "Denied" || status === "Incomplete Application") &&
        !!emailBody;

      return {
        id: item.jobId ?? index,
        applicantName: item.extracted_applicant_name || "-",
        program,
        status,
        totalScore: item.total_score ?? "-",
        submittedAt: item.submittedAt || "-",
        updatedAt: parseDate(item.submittedAt),
        comments: item.workflow_output_nllmt743b || "",
        emailBody,
        showEmail
      };
    });
  }, [apiData]);

  const programCounts = useMemo(() => {
    const counts = { ALL: data.length };
    PROGRAMS.forEach(p => (counts[p] = 0));
    data.forEach(d => counts[d.program]++);
    return counts;
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item =>
      programFilter === "ALL" ? true : item.program === programFilter
    );
  }, [data, programFilter]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  return (
    <div className="table-section">
      {/* ===== Program Tiles ===== */}
      <div className="program-tiles">
        <div
          className={`program-tile ${programFilter === "ALL" ? "active" : ""}`}
          onClick={() => setProgramFilter("ALL")}
        >
          <h4>Total Applicants</h4>
          <span>{programCounts.ALL}</span>
        </div>

        {PROGRAMS.map(program => (
          <div
            key={program}
            className={`program-tile ${
              programFilter === program ? "active" : ""
            }`}
            onClick={() => setProgramFilter(program)}
          >
            <h4>{program}</h4>
            <span>{programCounts[program]}</span>
          </div>
        ))}
      </div>

      {/* ===== Table ===== */}
      <table className="applications-table">
        <thead>
          <tr>
            <th>Applicant Name</th>
            <th>Program</th>
            <th>Application Status</th>
            <th>Overall Score</th>
            <th>Submitted At</th>
            <th>Comments</th>
            <th>Action</th>
            {/* <th>Email Sent</th> */}
          </tr>
        </thead>

        <tbody>
          {paginatedData.map(row => (
            <tr key={row.id}>
              <td>{row.applicantName}</td>

              <td>
                <span className="program-tag bsn">{row.program}</span>
              </td>

              <td>
                <span className="status-badge completed">
                  {row.status}
                </span>
              </td>

              <td><strong>{row.totalScore}</strong></td>
              <td>{row.submittedAt}</td>
              <td>{row.comments}</td>

              {/* Email Button */}
              <td>
                {row.showEmail && (
                  <button
                    className="email-btn"
                    onClick={() => setEmailModal(row)}
                  >
                    📧 View Email
                  </button>
                )}
              </td>

              {/* Email Sent */}
              {/* <td>
                {row.showEmail && (
                  <span className="email-sent">✔</span>
                )}
              </td> */}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ===== Email Modal ===== */}
      {emailModal && (
        <div
          className="email-modal-overlay"
          onClick={() => setEmailModal(null)}
        >
          <div
            className="email-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="email-modal-header">
              <h3>Email Preview</h3>
              <button
                className="close-btn"
                onClick={() => setEmailModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="email-modal-body">
              <pre>{emailModal.emailBody}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ===== Pagination ===== */}
      {totalPages > 1 && (
        <div className="table-controls">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Prev
          </button>

          <span>
            Page {currentPage} of {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ApplicationsTable;
