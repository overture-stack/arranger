// usage: node main.js source.json ../documents

const { promises: fs } = require('fs');
const path = require('path');

const generateRandomDate = (from = new Date('2019-04-01'), to = new Date()) => {
  const fromTime = from.getTime();
  const toTime = to.getTime();

  return new Date(fromTime + Math.random() * (toTime - fromTime));
};

const generateRandomNumber = (min = 0, max = 100, decimals = 0) =>
  (Math.random() * (max - min + 1) + min).toFixed(decimals);

const readFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  if (content.length > 0) {
    return JSON.parse(content);
  }

  throw 'could not read source file, or it was empty';
};

const reshapeObject = (sourceObj) => {
  if (Array.isArray(sourceObj?.files)) {
    return sourceObj.files.map((file, index) => ({
      analysis: {
        analysis_id: file.analysisId,
        analysis_state: index % 2 ? 'NOT PUBLISHED' : 'PUBLISHED',
        // to work on array fields, analysis tools plus a couple other fillers
        analysis_tools: [
          ...file.info.analysis_tools,
          sourceObj.workflow.workflow_short_name,
          sourceObj.experiment.platform,
        ],
        analysis_type:
          sourceObj.workflow.inputs?.[0]?.analysis_type || sourceObj.analysisType?.name,
        analysis_version: 1,
        experiment: {
          info: file.info,
          matched_normal_submitter_sample_id:
            sourceObj.samples?.[0]?.matchedNormalSubmitterSampleId,
          variantCallingTool: index % 2 ? 'silver bullet' : 'smufin',
        },
      },
      data_type: file.dataType,
      donors: sourceObj.samples.map((sample) => ({
        age: generateRandomNumber(0, 99),
        donor_id: sample.donor?.donorId,
        gender: sample.donor.gender,
        specimens: [
          {
            samples: [
              {
                collection_date: generateRandomDate(),
                matched_normal_submitter_sample_id: sample.matchedNormalSubmitterSampleId,
                sample_id: sample.sampleId,
                sample_type: sample.sampleType,
                submitter_sample_id: sample.submitterSampleId,
              },
            ],
            specimen_id: sample.specimen.specimenId,
            specimen_tissue_source: sample.specimen.specimenTissueSource,
            specimen_type: sample.specimen.specimenType,
            submitter_specimen_id: sample.specimen.submitterSpecimenId,
            tumour_normal_designation: sample.specimen.tumourNormalDesignation,
          },
        ],
        submitter_donor_id: sample.donor?.submitterDonorId,
        vaccinated: !!(index % 2),
      })),
      file: {
        data_type: file.dataType,
        index_file: {
          data_type: 'Variant Calling Index',
          file_type: 'IDX',
          md5sum: 'c03274816eb4907a92b8e5632cd6eb81',
          name: `example${generateRandomNumber(1, 9)}.vcf.gz.idx`,
          object_id: '70a2aa66-28d9-535e-b609-2743ed74e686',
          size: generateRandomNumber(6, 666666, 0),
        },
        md5sum: file.fileMd5sum,
        name: file.fileName,
        size: file.fileSize,
      },
      file_access: file.fileAccess,
      file_type: file.fileType,
      object_id: file.objectId,
      repositories: [
        {
          code: 'local_song',
          organization: 'local_song_organization',
          name: 'local_song_city',
          type: 'S3',
          country: 'local_song_country',
          url: 'http://song-server:8080',
        },
      ],
      study_id: sourceObj.studyId,
    }));
  }

  return [];
};

const saveFile = (filePath, content) => {
  if (content.object_id) {
    return fs.writeFile(
      path.join(path.resolve(filePath), `${content.object_id}.json`),
      JSON.stringify(content, null, 2),
    );
  }

  throw 'No Object ID to work with';
};

const docMaker = async (sourceFilePath, destinationFilePath) => {
  try {
    const sourceData = await readFile(sourceFilePath);

    if (Array.isArray(sourceData) && sourceData.length > 0) {
      sourceData.forEach((item) => {
        reshapeObject(item).forEach((file) => {
          saveFile(destinationFilePath, file);
        });
      });
    } else {
      reshapeObject(sourceData).forEach((file) => {
        saveFile(destinationFilePath, file);
      });
    }

    console.log('done!');
  } catch (err) {
    console.error('found error', err);
  }
};

if (process.argv.length > 2) {
  docMaker(process.argv[2], process.argv[3]);
} else {
  console.error('missing parameters');
}
