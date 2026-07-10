import { getAllJobs, updateJobResult, updateJobStatus, updateSecondaryJob } from "../services/jobStore.js"
import { getJobResult, getJobStatus } from "../services/opusApiService.js"

export const syncStatus = async () => {
  console.log("SYNCING STATUSES")
    const jobs = getAllJobs()
   await handlePrimaryJobs(jobs)
   await handleSecondaryJobs(jobs)
}

const handlePrimaryJobs = async (jobs) => {
  
    const inprogressJobs = jobs.filter(j => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status))
    
    for(let job of inprogressJobs){
        console.log(`Processing status check for ${job.jobId}`)
        const jobStatus = await getJobStatus(job.jobId) 
      console.log(`status is ${jobStatus.status}`)
        if(jobStatus.status !== 'IN_PROGRESS'){
            await updateJobStatus(job.jobId, jobStatus.status)
        }

        if(jobStatus.status === 'COMPLETED'){
            const jobResult = await getJobResult(job.jobId) 
            const resultFormated = extractKeyValue(jobResult)
            await updateJobResult(job.jobId, resultFormated)
            console.log(`Job ${job.jobId} completed`)
        }
    }
}

const handleSecondaryJobs = async (jobs) => {
  
    const inprogressJobs = jobs.filter(j => j.secondaryStatus && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.secondaryStatus))
    
    for(let job of inprogressJobs){
        console.log(`Processing status check for ${job.jobId}`)
        const jobStatus = await getJobStatus(job.secondaryJobId) 
      console.log(`status is ${jobStatus.status}`)

        if(jobStatus.status !== 'IN_PROGRESS'){
            await updateSecondaryJob(job.secondaryJobId, {secondaryStatus: jobStatus.status})
        }

        if(jobStatus.status === 'COMPLETED'){
            const jobResult = await getJobResult(job.secondaryJobId) 
            const resultFormated = extractKeyValue(jobResult)
            await updateSecondaryJob(job.secondaryJobId, resultFormated)
            console.log(`Job ${job.secondaryJobId} completed`)
        }
    }
}

function extractKeyValue(payload) {
  const result = {};

  Object.entries(payload.jobResultsPayloadSchema).forEach(
    ([key, obj]) => {
      result[key] = obj.value;
    }
  );

  return result;
}
