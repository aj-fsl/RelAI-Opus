import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import {
  fetchWorkflowSchema,
  prepareLanguageDetectionJob,
  runJob,
} from "../services/jobService.js";
import { logError, logInfo } from "../utils/logger.js";
import { executeJob, getJobResult, getPresignedUrl, getWorkflowSchema, initiateJob } from "../services/opusApiService.js";
import dotenv from "dotenv";
import axios from "axios";
import { createJob, getAllJobs, getJobsByGroupId, updateSecondaryJob, updateSecondaryJobByPrimaryJobId } from "../services/jobStore.js";
import { syncStatus } from "../jobs/statusSync.js";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(__dirname, "../../job_results.json");

const WORKFLOW_ID_PRIMARY = process.env.WORKFLOW_ID_PRIMARY;
const WORKFLOW_ID_SECONDARY = process.env.WORKFLOW_ID_SECONDARY;

const formatDate = (date) => {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

export const getJobSchemaController = async (req, res) => {
  try {
    logInfo("Schema discovery request received");
    const schema = await fetchWorkflowSchema();
    res.status(200).json(schema);
  } catch (error) {
    logError("Schema discovery failed", error);
    res.status(500).json({
      message: "Failed to retrieve workflow schema",
      error: error.message,
    });
  }
};

// Helper: extract input schema from workflow data
const getInputSchema = (workflowData) => {
  const inputNodeId = workflowData.workflow_input_node_id;
  const inputNode = workflowData.nodes?.[inputNodeId];
  return inputNode?.input_schema?.schema;
};

// Helper: build payload instance from schema
const buildPayloadInstance = (schema, inputData) => {
  const instance = {};
  for (const [key, field] of Object.entries(schema)) {
    instance[key] = { ...field, value: inputData[key] ?? field.value };
  }
  return instance;
};

export const executeWorkflowController = async (req, res) => {
  try {
    logInfo("Starting job execution", {});

    // Step 1: Get schema
    const workflowData = await getWorkflowSchema(WORKFLOW_ID_PRIMARY);
    const payloadInstance = buildPayloadInstance(getInputSchema(workflowData), req.body);

    // Step 2: Initiate job
    const { jobExecutionId } = await initiateJob(
      WORKFLOW_ID_PRIMARY,
      `Auto Execution`,
      'Test Job'
    );
 
    const payload = {
      jobId: jobExecutionId,
      isSecondaryWorkflowExecuted: false,
      fileUrl: req.body['nursing_cas_application_pdf'] || req.body['application_pdf'] || null,
      fileName: req.body['fileName'] || null,
      groupId: req.body['groupId'] || null,
      status: 'IN PROGRESS',
      submittedAt: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
    }
    await createJob(payload)
    // Step 3: Execute job
    const executeResult = await executeJob(jobExecutionId, payloadInstance);

    res.status(200).json({ result: executeResult })
  } catch (error) {
    logError("Primary workflow execution failed", error);
    res.status(500).json({ message: "Primary workflow execution failed", error: error.message });
  }
}


export const executeSecondaryWorkflowController = async (req, res) => {
  try {
    logInfo("Starting job execution 2", {});

    // Step 1: Get schema
    const workflowData = await getWorkflowSchema(WORKFLOW_ID_SECONDARY);
    const payloadInstance = buildPayloadInstance(getInputSchema(workflowData), req.body);

    // Step 2: Initiate job
    const { jobExecutionId } = await initiateJob(
      WORKFLOW_ID_SECONDARY,
      `Auto Execution`,
      'Test Job'
    );

    const payload = {
      secondaryJobId: jobExecutionId,
      isSecondaryWorkflowExecuted: true,
      secondaryStatus: 'IN PROGRESS',
    }
 
    await updateSecondaryJobByPrimaryJobId(req.params.primaryJobId, payload)
    // Step 3: Execute job
    const executeResult = await executeJob(jobExecutionId, payloadInstance);

    res.status(200).json({ result: executeResult })
  } catch (error) {
    logError("Secondary workflow execution failed", error);
    res.status(500).json({ message: "Secondary workflow execution failed", error: error.message });
  }
}

export const getPresignedUrlController = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "File is required" });
    }

    const fileExtension = file.originalname.split(".").pop().toLowerCase();
    const result = await getPresignedUrl(fileExtension);

    const { presignedUrl, fileUrl } = result;

    console.log({ type: file.mimetype, size: file.size })
    // 2️⃣ Upload file to S3 FROM BACKEND
    await axios.put(presignedUrl, file.buffer, {
      headers: {
        "Content-Type": file.mimetype,
        "Content-Length": file.size,
      },
    });

    // 3️⃣ Return final file URL
    return res.status(200).json({
      message: "File uploaded successfully",
      result: { fileUrl },
    });
  } catch (error) {
    logError("File upload failed", error);
    return res.status(500).json({
      message: "File upload failed",
      error: error.message,
    });
  }
}

export const prepareLanguageDetectionController = async (req, res) => {
  const { title, description } = req.body || {};

  if (!title || !description) {
    return res.status(400).json({
      message: "Missing required fields: title, description",
    });
  }

  try {
    logInfo("Prepare API called", { title });

    const response = await prepareLanguageDetectionJob({
      title,
      description,
    });

    res.status(201).json(response);
  } catch (error) {
    logError("Prepare API failed", error);
    res.status(500).json({
      message: "Failed to prepare language detection job",
      error: error.message,
    });
  }
};


export const executeJobController = async (req, res) => {
  const { jobId, jobName, jobDescription, inputData } = req.body;

  const startTime = new Date();
  let logEntry = {
    jobId,
    jobName,
    startTime: startTime.toISOString(),
    startTimeFormatted: formatDate(startTime),
    status: "PENDING",
  };

  if (!jobId || !jobName || !jobDescription) {
    return res.status(400).json({
      message: "Missing required job parameters",
    });
  }

  try {
    const result = await runJob({
      jobId,
      jobName,
      jobDescription,
      inputData,
    });

    const endTime = new Date();
    logEntry = {
      ...logEntry,
      endTime: endTime.toISOString(),
      endTimeFormatted: formatDate(endTime),
      durationMs: endTime - startTime,
      status: "SUCCESS",
      statusCode: 200,
    };

    await appendToLogFile(logEntry);

    res.status(200).json({
      message: "Job executed successfully",
      result,
    });
  } catch (error) {
    const endTime = new Date();
    logEntry = {
      ...logEntry,
      endTime: endTime.toISOString(),
      endTimeFormatted: formatDate(endTime),
      durationMs: endTime - startTime,
      status: "FAILED",
      statusCode: error?.response?.status || 500,
      errorMessage: error?.message || "Unknown Error",
    };

    await appendToLogFile(logEntry);
    logError("Job execution error", error);

    res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
};


const appendToLogFile = async (entry) => {
  try {
    const existing = (await fs.pathExists(logFile))
      ? JSON.parse(await fs.readFile(logFile, "utf-8"))
      : [];

    existing.push(entry);
    await fs.writeFile(logFile, JSON.stringify(existing, null, 2));
  } catch (err) {
    logError("Error writing log file", err);
  }
};

export const getAllJobsController = async (req, res) => {
  await syncStatus()
  const jobs = getAllJobs()
  res.status(200).json({ result: jobs });
}


export const getJobResultController = async (req, res) => {
  const result = await getJobResult(req.params.jobId)
  res.status(200).json({ result: result });
}

export const getPresignedUrlControllerOnlyUrl = async (req, res) => {

  const result = await getPresignedUrl("pdf");



  // 3️⃣ Return final file URL
  return res.status(200).json({
    message: "File uploaded successfully",
    result,
  });
}

export const getJobsByGroupIdController = async (req, res) => {
  // await syncStatus()
  const result = await getJobsByGroupId(req.params.groupId).sort((a, b) => Number(b.jobId) - Number(a.jobId))
  res.status(200).json({ result: result });
}

export const getJobsForUploadSectionController = async (req, res) => {
  // await syncStatus()
  const allJobs = getAllJobs()
  const filteredJobs = allJobs.filter(j => j.secondaryStatus != 'COMPLETED').sort((a, b) => Number(b.jobId) - Number(a.jobId))
  res.status(200).json({ result: filteredJobs });
}

export const getJobsForDashboardSectionController = async (req, res) => {
  // await syncStatus();

  const allJobs = getAllJobs();

  // Step 1: apply your existing filter
  const filteredJobs = allJobs.filter(
    j =>
      j.secondaryStatus === "COMPLETED" ||
      (j.workflow_output_npfmlabni && j.workflow_output_npfmlabni !== "BSN")
  ).sort((a, b) => Number(b.jobId) - Number(a.jobId));

  // Step 2: dedupe by fileName, keep latest jobId
  const uniqueByFileNameMap = new Map();

  for (const job of filteredJobs) {
    const existing = uniqueByFileNameMap.get(job.fileName);

    if (
      !existing ||
      Number(job.jobId) > Number(existing.jobId)
    ) {
      uniqueByFileNameMap.set(job.fileName, job);
    }
  }

  const uniqueLatestJobs = Array.from(uniqueByFileNameMap.values()).sort((a, b) => Number(b.jobId) - Number(a.jobId));

  res.status(200).json({ result: uniqueLatestJobs });
};
