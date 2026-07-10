import React, { useRef, useState, useEffect } from "react";
import { executePrimaryWorkflowApi, executeSecondaryWorkflowApi, getJobsByGroupIdApi, uploadFileApi } from "../../api/uploadApi";
import axios from "axios";
import { toast } from "react-toastify";

// ---- Constants ----
const MAX_FILE_SIZE_MB = 10;
const PRIMARY_WORKFLOW_FILE_INPUT_KEY = "nursing_cas_application_pdf"
const SECONDARY_WORKFLOW_FILE_INPUT_KEY = "nursing_cas_application_pdf"

const executePrimaryWorkflow = async (file, groupId) => {
    const urlResult = await uploadFileApi(file);
    const fileUrl = urlResult?.result?.fileUrl;

    if (fileUrl) {
        // await axios.put(presignedUrl, file, {
        //     headers: {
        //         'Content-Type': 'application/pdf',
        //     },
        // });

        const result = await executePrimaryWorkflowApi({ [PRIMARY_WORKFLOW_FILE_INPUT_KEY]: fileUrl, groupId: groupId, fileName: file.name });

        return result?.result;
    }

};

const UploadSection = () => {
    const fileInputRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [groupId, setGroupId] = useState(null);
    const [loading, setLoading] = useState([]);

    // Uploaded jobs (LOCAL table state)
    const [jobs, setJobs] = useState([]);
    const [executedJobs, setExecutedJobs] = useState([]);

    const showSuccess = (message) => {
        toast.success(message);
    };

    useEffect(() => {
        // if (!groupId) return;

        // Initial fetch
        getJobsByGroupId();

        const intervalId = setInterval(() => {
            getJobsByGroupId(groupId);
        }, 15000); // 10 seconds

        return () => {
            clearInterval(intervalId);
        };
    }, [groupId]);

    // ---- Validation ----
    const validateFile = (file) => {
        if (file.type !== "application/pdf") {
            return "Only PDF files are allowed.";
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return "File size should not exceed 10 MB.";
        }
        return null;
    };

    const handleFileSelect = (e) => {
        setError("");
        const selectedFiles = Array.from(e.target.files);

        const validFiles = [];
        for (const file of selectedFiles) {
            const err = validateFile(file);
            if (err) {
                setError(err);
                continue;
            }
            if (files.some(f => f.name === file.name)) {
                setError(`File "${file.name}" already added.`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length) {
            setFiles(prev => [...prev, ...validFiles]);
        }

        e.target.value = null;
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setError("");
    };

    // ---- Upload handler ----
    const handleUpload = async () => {
        if (!files.length) return;

        setUploading(true);
        setError("");

        const groupId =
            Math.floor(Math.random() * (1000000 - 1000 + 1)) + 1000;

        localStorage.setItem("groupId", groupId);

        const uploadPromises = files.map(file =>
            executePrimaryWorkflow(file, groupId).then(presigned => ({
                jobId: presigned.primaryJobId,
                fileName: file.name,
                program: presigned.program,
                status: presigned.primaryStatus,
                isExecuted: presigned.isExecuted,
                submittedAt: new Date(),
            }))
        );

        const results = await Promise.allSettled(uploadPromises);

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                // uploadedJobs.push(result.value);
            } else {
                console.error(
                    `Upload failed for ${files[index].name}:`,
                    result.reason
                );
                // failedFiles.push(files[index].name);
            }
        });

        // if (failedFiles.length) {
        //     setError(
        //         `Failed to upload: ${failedFiles.join(", ")}`
        //     );
        // }
        setGroupId(groupId);
        setFiles([]);
        setUploading(false);
    };

    const getJobsByGroupId = async () => {
        const jobsResult = await getJobsByGroupIdApi();

        const jobsToExecute = jobsResult?.result?.filter(job => !job.isSecondaryWorkflowExecuted)?.slice(0, 10);
        const executedJobs = jobsResult?.result?.filter(job => job.isSecondaryWorkflowExecuted && !['COMPLETED'].includes(job.secondaryStatus))
        setJobs(jobsToExecute);
        setExecutedJobs(executedJobs);
    }

    const handleExecute = async (job) => {

        const fileUrl = job.fileUrl;
        const primaryJobId = job.jobId;
        setLoading(prev => [...prev, primaryJobId]);

        const result = await executeSecondaryWorkflowApi({ [SECONDARY_WORKFLOW_FILE_INPUT_KEY]: fileUrl }, primaryJobId);
        setLoading(prev => prev.filter(id => id !== primaryJobId));

        showSuccess("Application is executed successfully, Please check the further status in executed jobs section.");
        // Refresh jobs
        getJobsByGroupId(groupId);
    };

    return (
        <div className="upload-section">
            <h3 className="section-title">Upload Documents</h3>

            {/* Upload box */}
            <div
                className="upload-dropzone"
                onClick={() => fileInputRef.current.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf"
                    hidden
                    onChange={handleFileSelect}
                />
                <p>
                    <strong>Click to upload</strong> or drag and drop PDF files
                </p>
                <span>Only PDF • Max 10MB per file</span>
            </div>

            {/* Error */}
            {error && <div className="upload-error">{error}</div>}

            {/* Selected files */}
            {files.length > 0 && (
                <div className="upload-files">
                    {files.map((file, index) => (
                        <div key={index} className="upload-file">
                            <div>
                                <strong>{file.name}</strong>
                                <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <button className="remove-btn" onClick={() => removeFile(index)}>
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload button */}
            <div className="upload-actions">
                <button
                    className="btn-primary"
                    // disabled={!files.length || uploading || !!error}
                    onClick={handleUpload}
                >
                    {uploading ? "Uploading..." : `Upload ${files.length} File(s)`}
                </button>
            </div>

            {/* ===== Uploaded Jobs Table ===== */}
            {jobs.length > 0 && (
                <div style={{ marginTop: "32px" }}>
                    <h3 className="section-title">Uploaded Jobs</h3>

                    <table className="applications-table">
                        <thead>
                            <tr>
                                <th>File Name</th>
                                <th>Program</th>
                                <th>Applicant Name</th>
                                <th>Job Status</th>
                                <th>Submitted At</th>
                                <th>Action</th>
                                <th>Job Link</th>
                            </tr>
                        </thead>

                        <tbody>
                            {jobs.map(job => (
                                <tr key={job.jobId}>
                                    <td>{job.fileName}</td>

                                    <td>
                                        <span
                                            className={`program-tag ${job?.program?.toLowerCase()}`}
                                        >
                                            {job.workflow_output_npfmlabni}
                                        </span>
                                    </td>

                                    <td>{job.extracted_applicant_name}</td>

                                    <td>
                                        <span className="status-badge under-review">
                                            {job.status}
                                        </span>
                                    </td>

                                    <td>{job?.submittedAt}</td>

                                    <td>
                                        {job.workflow_output_npfmlabni && job.workflow_output_npfmlabni === "BSN" &&
                                            <button
                                                className="btn-primary"
                                                onClick={() => loading.includes(job.jobId) ? null : handleExecute(job)}
                                            >
                                                {loading.includes(job.jobId) ? "Reviewing..." : "Review"}
                                            </button>}
                                    </td>

                                    {/* JOB LINK COLUMN */}
                                    <td>
                                        <a
                                            href={`https://app.opus.com/app/dashboard/job/${job.jobId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="view-job-link"
                                        >
                                            View Job
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {executedJobs.length > 0 && (
                <div style={{ marginTop: "32px" }}>
                    <h3 className="section-title">Executed Jobs</h3>

                    <table className="applications-table">
                        <thead>
                            <tr>
                                <th>File Name</th>
                                <th>Program</th>
                                <th>Applicant Name</th>
                                <th>Job Status</th>
                                <th>Submitted At</th>
                                <th>Job Link</th>
                            </tr>
                        </thead>

                        <tbody>
                            {executedJobs.map(job => (
                                <tr key={job.jobId}>
                                    <td>{job.fileName}</td>

                                    <td>
                                        <span
                                            className={`program-tag ${job?.program?.toLowerCase()}`}
                                        >
                                            {job.workflow_output_npfmlabni}
                                        </span>
                                    </td>

                                    <td>{job.extracted_applicant_name}</td>

                                    <td>
                                        <span className="status-badge under-review">
                                            {job.secondaryStatus}
                                        </span>
                                    </td>

                                    <td>{job?.submittedAt}</td>

                                    {/* JOB LINK COLUMN */}
                                    <td>
                                        <a
                                            href={`https://app.opus.com/app/dashboard/job/${job.secondaryJobId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="view-job-link"
                                        >
                                            View Job
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default UploadSection;
