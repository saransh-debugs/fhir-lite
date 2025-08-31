export type DicomStudyShape = {
    studyInstanceUID: string;
    series: { seriesInstanceUID: string; instances: { sopInstanceUID: string }[] }[];
  };
  
  export function toImagingStudy(patientFhirId: string, study: DicomStudyShape) {
    return {
      resourceType: "ImagingStudy",
      status: "available",
      subject: { reference: `Patient/${patientFhirId}` },
      uid: `urn:oid:${study.studyInstanceUID}`,
      series: study.series.map((s) => ({
        uid: `urn:oid:${s.seriesInstanceUID}`,
        instance: s.instances.map((i) => ({ uid: `urn:oid:${i.sopInstanceUID}` })),
      })),
    };
  }
  