import axiosAgent from "./axiosAgent";

export const getPresignedUrlApi = (payload) => {
  return axiosAgent.get("/jobs/presigned-url", payload);
};

export const executePrimaryWorkflowApi = (body) => {
  return axiosAgent.post(`/jobs/execute-primary`, body);
};

export const getJobsByGroupIdApi = () => {
  return axiosAgent.get(`/jobs/jobs-for-upload-section`);
};

export const getAllJobsApi = () => {
  return axiosAgent.get(`/jobs/list`);
};

export const executeSecondaryWorkflowApi = (body, primaryJobId) => {
  return axiosAgent.post(`/jobs/execute-secondary/${primaryJobId}`, body);
};

export const getJobsForDashboardApi = () => {
  return axiosAgent.get(`/jobs/jobs-for-dashboard-section`);
};


export const uploadFileApi = (file) => {
  const formData = new FormData();
  formData.append("file", file);

  return axiosAgent.post("/jobs/upload-file", formData, {
    headers:{ 
      "Content-Type": "multipart/form-data"
    }
  });
};

