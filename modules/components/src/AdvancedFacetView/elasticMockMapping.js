export default {
  access: {
    type: 'keyword',
  },
  acl: {
    type: 'keyword',
  },
  analysis: {
    properties: {
      analysis_id: {
        type: 'keyword',
      },
      analysis_type: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      input_files: {
        type: 'nested',
        properties: {
          access: {
            type: 'keyword',
          },
          created_datetime: {
            type: 'keyword',
          },
          data_category: {
            type: 'keyword',
          },
          data_format: {
            type: 'keyword',
          },
          data_type: {
            type: 'keyword',
          },
          error_type: {
            type: 'keyword',
          },
          experimental_strategy: {
            type: 'keyword',
          },
          file_id: {
            type: 'keyword',
          },
          file_name: {
            type: 'keyword',
          },
          file_size: {
            type: 'long',
          },
          file_state: {
            type: 'keyword',
          },
          md5sum: {
            type: 'keyword',
          },
          platform: {
            type: 'keyword',
          },
          revision: {
            type: 'long',
          },
          state: {
            type: 'keyword',
          },
          state_comment: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
        },
      },
      metadata: {
        properties: {
          read_groups: {
            type: 'nested',
            properties: {
              RIN: {
                type: 'long',
              },
              adapter_name: {
                type: 'keyword',
              },
              adapter_sequence: {
                type: 'keyword',
              },
              base_caller_name: {
                type: 'keyword',
              },
              base_caller_version: {
                type: 'keyword',
              },
              created_datetime: {
                type: 'keyword',
              },
              experiment_name: {
                type: 'keyword',
              },
              flow_cell_barcode: {
                type: 'keyword',
              },
              includes_spike_ins: {
                type: 'keyword',
              },
              instrument_model: {
                type: 'keyword',
              },
              is_paired_end: {
                type: 'keyword',
              },
              library_name: {
                type: 'keyword',
              },
              library_preparation_kit_catalog_number: {
                type: 'keyword',
              },
              library_preparation_kit_name: {
                type: 'keyword',
              },
              library_preparation_kit_vendor: {
                type: 'keyword',
              },
              library_preparation_kit_version: {
                type: 'keyword',
              },
              library_selection: {
                type: 'keyword',
              },
              library_strand: {
                type: 'keyword',
              },
              library_strategy: {
                type: 'keyword',
              },
              platform: {
                type: 'keyword',
              },
              read_group_id: {
                type: 'keyword',
              },
              read_group_name: {
                type: 'keyword',
              },
              read_group_qcs: {
                type: 'nested',
                properties: {
                  adapter_content: {
                    type: 'keyword',
                  },
                  basic_statistics: {
                    type: 'keyword',
                  },
                  created_datetime: {
                    type: 'keyword',
                  },
                  encoding: {
                    type: 'keyword',
                  },
                  fastq_name: {
                    type: 'keyword',
                  },
                  kmer_content: {
                    type: 'keyword',
                  },
                  overrepresented_sequences: {
                    type: 'keyword',
                  },
                  per_base_n_content: {
                    type: 'keyword',
                  },
                  per_base_sequence_content: {
                    type: 'keyword',
                  },
                  per_base_sequence_quality: {
                    type: 'keyword',
                  },
                  per_sequence_gc_content: {
                    type: 'keyword',
                  },
                  per_sequence_quality_score: {
                    type: 'keyword',
                  },
                  per_tile_sequence_quality: {
                    type: 'keyword',
                  },
                  percent_gc_content: {
                    type: 'long',
                  },
                  read_group_qc_id: {
                    type: 'keyword',
                  },
                  sequence_duplication_levels: {
                    type: 'keyword',
                  },
                  sequence_length_distribution: {
                    type: 'keyword',
                  },
                  state: {
                    type: 'keyword',
                  },
                  submitter_id: {
                    type: 'keyword',
                  },
                  total_sequences: {
                    type: 'long',
                  },
                  updated_datetime: {
                    type: 'keyword',
                  },
                  workflow_end_datetime: {
                    type: 'keyword',
                  },
                  workflow_link: {
                    type: 'keyword',
                  },
                  workflow_start_datetime: {
                    type: 'keyword',
                  },
                  workflow_type: {
                    type: 'keyword',
                  },
                  workflow_version: {
                    type: 'keyword',
                  },
                },
              },
              read_length: {
                type: 'long',
              },
              sequencing_center: {
                type: 'keyword',
              },
              sequencing_date: {
                type: 'keyword',
              },
              size_selection_range: {
                type: 'keyword',
              },
              spike_ins_concentration: {
                type: 'keyword',
              },
              spike_ins_fasta: {
                type: 'keyword',
              },
              state: {
                type: 'keyword',
              },
              submitter_id: {
                type: 'keyword',
              },
              target_capture_kit_catalog_number: {
                type: 'keyword',
              },
              target_capture_kit_name: {
                type: 'keyword',
              },
              target_capture_kit_target_region: {
                type: 'keyword',
              },
              target_capture_kit_vendor: {
                type: 'keyword',
              },
              target_capture_kit_version: {
                type: 'keyword',
              },
              to_trim_adapter_sequence: {
                type: 'keyword',
              },
              updated_datetime: {
                type: 'keyword',
              },
            },
          },
        },
      },
      state: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      updated_datetime: {
        type: 'keyword',
      },
      workflow_end_datetime: {
        type: 'keyword',
      },
      workflow_link: {
        type: 'keyword',
      },
      workflow_start_datetime: {
        type: 'keyword',
      },
      workflow_type: {
        type: 'keyword',
      },
      workflow_version: {
        type: 'keyword',
      },
    },
  },
  annotations: {
    type: 'nested',
    properties: {
      annotation_id: {
        type: 'keyword',
      },
      case_id: {
        type: 'keyword',
      },
      case_submitter_id: {
        type: 'keyword',
      },
      category: {
        type: 'keyword',
      },
      classification: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      creator: {
        type: 'keyword',
      },
      entity_id: {
        type: 'keyword',
      },
      entity_submitter_id: {
        type: 'keyword',
      },
      entity_type: {
        type: 'keyword',
      },
      legacy_created_datetime: {
        type: 'keyword',
      },
      legacy_updated_datetime: {
        type: 'keyword',
      },
      notes: {
        type: 'keyword',
      },
      state: {
        type: 'keyword',
      },
      status: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      updated_datetime: {
        type: 'keyword',
      },
    },
  },
  archive: {
    properties: {
      archive_id: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      data_category: {
        type: 'keyword',
      },
      data_format: {
        type: 'keyword',
      },
      data_type: {
        type: 'keyword',
      },
      error_type: {
        type: 'keyword',
      },
      file_name: {
        type: 'keyword',
      },
      file_size: {
        type: 'long',
      },
      file_state: {
        type: 'keyword',
      },
      md5sum: {
        type: 'keyword',
      },
      revision: {
        type: 'long',
      },
      state: {
        type: 'keyword',
      },
      state_comment: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      updated_datetime: {
        type: 'keyword',
      },
    },
  },
  associated_entities: {
    type: 'nested',
    properties: {
      case_id: {
        type: 'keyword',
      },
      entity_id: {
        type: 'keyword',
      },
      entity_submitter_id: {
        type: 'keyword',
      },
      entity_type: {
        type: 'keyword',
      },
    },
  },
  cases: {
    type: 'nested',
    properties: {
      aliquot_ids: {
        type: 'keyword',
      },
      analyte_ids: {
        type: 'keyword',
      },
      annotations: {
        type: 'nested',
        properties: {
          annotation_id: {
            type: 'keyword',
          },
          case_id: {
            type: 'keyword',
          },
          case_submitter_id: {
            type: 'keyword',
          },
          category: {
            type: 'keyword',
          },
          classification: {
            type: 'keyword',
          },
          created_datetime: {
            type: 'keyword',
          },
          creator: {
            type: 'keyword',
          },
          entity_id: {
            type: 'keyword',
          },
          entity_submitter_id: {
            type: 'keyword',
          },
          entity_type: {
            type: 'keyword',
          },
          legacy_created_datetime: {
            type: 'keyword',
          },
          legacy_updated_datetime: {
            type: 'keyword',
          },
          notes: {
            type: 'keyword',
          },
          state: {
            type: 'keyword',
          },
          status: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
        },
      },
      case_id: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      days_to_index: {
        type: 'long',
      },
      demographic: {
        properties: {
          created_datetime: {
            type: 'keyword',
          },
          demographic_id: {
            type: 'keyword',
          },
          ethnicity: {
            type: 'keyword',
          },
          gender: {
            type: 'keyword',
          },
          race: {
            type: 'keyword',
          },
          state: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
          year_of_birth: {
            type: 'long',
          },
          year_of_death: {
            type: 'long',
          },
        },
      },
      diagnoses: {
        type: 'nested',
        properties: {
          age_at_diagnosis: {
            type: 'long',
          },
          ajcc_clinical_m: {
            type: 'keyword',
          },
          ajcc_clinical_n: {
            type: 'keyword',
          },
          ajcc_clinical_stage: {
            type: 'keyword',
          },
          ajcc_clinical_t: {
            type: 'keyword',
          },
          ajcc_pathologic_m: {
            type: 'keyword',
          },
          ajcc_pathologic_n: {
            type: 'keyword',
          },
          ajcc_pathologic_stage: {
            type: 'keyword',
          },
          ajcc_pathologic_t: {
            type: 'keyword',
          },
          ann_arbor_b_symptoms: {
            type: 'keyword',
          },
          ann_arbor_clinical_stage: {
            type: 'keyword',
          },
          ann_arbor_extranodal_involvement: {
            type: 'keyword',
          },
          ann_arbor_pathologic_stage: {
            type: 'keyword',
          },
          burkitt_lymphoma_clinical_variant: {
            type: 'keyword',
          },
          cause_of_death: {
            type: 'keyword',
          },
          circumferential_resection_margin: {
            type: 'long',
          },
          classification_of_tumor: {
            type: 'keyword',
          },
          colon_polyps_history: {
            type: 'keyword',
          },
          created_datetime: {
            type: 'keyword',
          },
          days_to_birth: {
            type: 'long',
          },
          days_to_death: {
            type: 'long',
          },
          days_to_hiv_diagnosis: {
            type: 'long',
          },
          days_to_last_follow_up: {
            type: 'long',
          },
          days_to_last_known_disease_status: {
            type: 'long',
          },
          days_to_new_event: {
            type: 'long',
          },
          days_to_recurrence: {
            type: 'long',
          },
          diagnosis_id: {
            type: 'keyword',
          },
          figo_stage: {
            type: 'keyword',
          },
          hiv_positive: {
            type: 'keyword',
          },
          hpv_positive_type: {
            type: 'keyword',
          },
          hpv_status: {
            type: 'keyword',
          },
          last_known_disease_status: {
            type: 'keyword',
          },
          laterality: {
            type: 'keyword',
          },
          ldh_level_at_diagnosis: {
            type: 'long',
          },
          ldh_normal_range_upper: {
            type: 'long',
          },
          lymph_nodes_positive: {
            type: 'long',
          },
          lymphatic_invasion_present: {
            type: 'keyword',
          },
          method_of_diagnosis: {
            type: 'keyword',
          },
          morphology: {
            type: 'keyword',
          },
          new_event_anatomic_site: {
            type: 'keyword',
          },
          new_event_type: {
            type: 'keyword',
          },
          perineural_invasion_present: {
            type: 'keyword',
          },
          primary_diagnosis: {
            type: 'keyword',
          },
          prior_malignancy: {
            type: 'keyword',
          },
          prior_treatment: {
            type: 'keyword',
          },
          progression_or_recurrence: {
            type: 'keyword',
          },
          residual_disease: {
            type: 'keyword',
          },
          site_of_resection_or_biopsy: {
            type: 'keyword',
          },
          state: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          tissue_or_organ_of_origin: {
            type: 'keyword',
          },
          treatments: {
            type: 'nested',
            properties: {
              created_datetime: {
                type: 'keyword',
              },
              days_to_treatment: {
                type: 'long',
              },
              days_to_treatment_end: {
                type: 'long',
              },
              days_to_treatment_start: {
                type: 'long',
              },
              state: {
                type: 'keyword',
              },
              submitter_id: {
                type: 'keyword',
              },
              therapeutic_agents: {
                type: 'keyword',
              },
              treatment_anatomic_site: {
                type: 'keyword',
              },
              treatment_id: {
                type: 'keyword',
              },
              treatment_intent_type: {
                type: 'keyword',
              },
              treatment_or_therapy: {
                type: 'keyword',
              },
              treatment_outcome: {
                type: 'keyword',
              },
              treatment_type: {
                type: 'keyword',
              },
              updated_datetime: {
                type: 'keyword',
              },
            },
          },
          tumor_grade: {
            type: 'keyword',
          },
          tumor_stage: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
          vascular_invasion_present: {
            type: 'keyword',
          },
          vital_status: {
            type: 'keyword',
          },
          year_of_diagnosis: {
            type: 'long',
          },
        },
      },
      disease_type: {
        type: 'keyword',
      },
      exposures: {
        type: 'nested',
        properties: {
          alcohol_history: {
            type: 'keyword',
          },
          alcohol_intensity: {
            type: 'keyword',
          },
          bmi: {
            type: 'long',
          },
          cigarettes_per_day: {
            type: 'long',
          },
          created_datetime: {
            type: 'keyword',
          },
          exposure_id: {
            type: 'keyword',
          },
          height: {
            type: 'long',
          },
          pack_years_smoked: {
            type: 'long',
          },
          state: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          tobacco_smoking_onset_year: {
            type: 'long',
          },
          tobacco_smoking_quit_year: {
            type: 'long',
          },
          tobacco_smoking_status: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
          weight: {
            type: 'long',
          },
          years_smoked: {
            type: 'long',
          },
        },
      },
      family_histories: {
        type: 'nested',
        properties: {
          created_datetime: {
            type: 'keyword',
          },
          family_history_id: {
            type: 'keyword',
          },
          relationship_age_at_diagnosis: {
            type: 'long',
          },
          relationship_gender: {
            type: 'keyword',
          },
          relationship_primary_diagnosis: {
            type: 'keyword',
          },
          relationship_type: {
            type: 'keyword',
          },
          relative_with_cancer_history: {
            type: 'keyword',
          },
          state: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
        },
      },
      portion_ids: {
        type: 'keyword',
      },
      primary_site: {
        type: 'keyword',
      },
      project: {
        properties: {
          dbgap_accession_number: {
            type: 'keyword',
          },
          disease_type: {
            type: 'keyword',
          },
          intended_release_date: {
            type: 'keyword',
          },
          name: {
            type: 'keyword',
          },
          primary_site: {
            type: 'keyword',
          },
          program: {
            properties: {
              dbgap_accession_number: {
                type: 'keyword',
              },
              name: {
                type: 'keyword',
              },
              program_id: {
                type: 'keyword',
              },
            },
          },
          project_id: {
            type: 'keyword',
          },
          releasable: {
            type: 'keyword',
          },
          released: {
            type: 'keyword',
          },
          state: {
            type: 'keyword',
          },
        },
      },
      sample_ids: {
        type: 'keyword',
      },
      samples: {
        type: 'nested',
        properties: {
          annotations: {
            type: 'nested',
            properties: {
              annotation_id: {
                type: 'keyword',
              },
              case_id: {
                type: 'keyword',
              },
              case_submitter_id: {
                type: 'keyword',
              },
              category: {
                type: 'keyword',
              },
              classification: {
                type: 'keyword',
              },
              created_datetime: {
                type: 'keyword',
              },
              creator: {
                type: 'keyword',
              },
              entity_id: {
                type: 'keyword',
              },
              entity_submitter_id: {
                type: 'keyword',
              },
              entity_type: {
                type: 'keyword',
              },
              legacy_created_datetime: {
                type: 'keyword',
              },
              legacy_updated_datetime: {
                type: 'keyword',
              },
              notes: {
                type: 'keyword',
              },
              state: {
                type: 'keyword',
              },
              status: {
                type: 'keyword',
              },
              submitter_id: {
                type: 'keyword',
              },
              updated_datetime: {
                type: 'keyword',
              },
            },
          },
          biospecimen_anatomic_site: {
            type: 'keyword',
          },
          composition: {
            type: 'keyword',
          },
          created_datetime: {
            type: 'keyword',
          },
          current_weight: {
            type: 'long',
          },
          days_to_collection: {
            type: 'long',
          },
          days_to_sample_procurement: {
            type: 'long',
          },
          diagnosis_pathologically_confirmed: {
            type: 'keyword',
          },
          freezing_method: {
            type: 'keyword',
          },
          initial_weight: {
            type: 'long',
          },
          intermediate_dimension: {
            type: 'keyword',
          },
          is_ffpe: {
            type: 'keyword',
          },
          longest_dimension: {
            type: 'keyword',
          },
          method_of_sample_procurement: {
            type: 'keyword',
          },
          oct_embedded: {
            type: 'keyword',
          },
          pathology_report_uuid: {
            type: 'keyword',
          },
          portions: {
            type: 'nested',
            properties: {
              analytes: {
                type: 'nested',
                properties: {
                  a260_a280_ratio: {
                    type: 'long',
                  },
                  aliquots: {
                    type: 'nested',
                    properties: {
                      aliquot_id: {
                        type: 'keyword',
                      },
                      aliquot_quantity: {
                        type: 'long',
                      },
                      aliquot_volume: {
                        type: 'long',
                      },
                      amount: {
                        type: 'long',
                      },
                      analyte_type: {
                        type: 'keyword',
                      },
                      analyte_type_id: {
                        type: 'keyword',
                      },
                      annotations: {
                        type: 'nested',
                        properties: {
                          annotation_id: {
                            type: 'keyword',
                          },
                          case_id: {
                            type: 'keyword',
                          },
                          case_submitter_id: {
                            type: 'keyword',
                          },
                          category: {
                            type: 'keyword',
                          },
                          classification: {
                            type: 'keyword',
                          },
                          created_datetime: {
                            type: 'keyword',
                          },
                          creator: {
                            type: 'keyword',
                          },
                          entity_id: {
                            type: 'keyword',
                          },
                          entity_submitter_id: {
                            type: 'keyword',
                          },
                          entity_type: {
                            type: 'keyword',
                          },
                          legacy_created_datetime: {
                            type: 'keyword',
                          },
                          legacy_updated_datetime: {
                            type: 'keyword',
                          },
                          notes: {
                            type: 'keyword',
                          },
                          state: {
                            type: 'keyword',
                          },
                          status: {
                            type: 'keyword',
                          },
                          submitter_id: {
                            type: 'keyword',
                          },
                          updated_datetime: {
                            type: 'keyword',
                          },
                        },
                      },
                      center: {
                        properties: {
                          center_id: {
                            type: 'keyword',
                          },
                          center_type: {
                            type: 'keyword',
                          },
                          code: {
                            type: 'keyword',
                          },
                          name: {
                            type: 'keyword',
                          },
                          namespace: {
                            type: 'keyword',
                          },
                          short_name: {
                            type: 'keyword',
                          },
                        },
                      },
                      concentration: {
                        type: 'long',
                      },
                      created_datetime: {
                        type: 'keyword',
                      },
                      source_center: {
                        type: 'keyword',
                      },
                      state: {
                        type: 'keyword',
                      },
                      submitter_id: {
                        type: 'keyword',
                      },
                      updated_datetime: {
                        type: 'keyword',
                      },
                    },
                  },
                  amount: {
                    type: 'long',
                  },
                  analyte_id: {
                    type: 'keyword',
                  },
                  analyte_quantity: {
                    type: 'long',
                  },
                  analyte_type: {
                    type: 'keyword',
                  },
                  analyte_type_id: {
                    type: 'keyword',
                  },
                  analyte_volume: {
                    type: 'long',
                  },
                  annotations: {
                    type: 'nested',
                    properties: {
                      annotation_id: {
                        type: 'keyword',
                      },
                      case_id: {
                        type: 'keyword',
                      },
                      case_submitter_id: {
                        type: 'keyword',
                      },
                      category: {
                        type: 'keyword',
                      },
                      classification: {
                        type: 'keyword',
                      },
                      created_datetime: {
                        type: 'keyword',
                      },
                      creator: {
                        type: 'keyword',
                      },
                      entity_id: {
                        type: 'keyword',
                      },
                      entity_submitter_id: {
                        type: 'keyword',
                      },
                      entity_type: {
                        type: 'keyword',
                      },
                      legacy_created_datetime: {
                        type: 'keyword',
                      },
                      legacy_updated_datetime: {
                        type: 'keyword',
                      },
                      notes: {
                        type: 'keyword',
                      },
                      state: {
                        type: 'keyword',
                      },
                      status: {
                        type: 'keyword',
                      },
                      submitter_id: {
                        type: 'keyword',
                      },
                      updated_datetime: {
                        type: 'keyword',
                      },
                    },
                  },
                  concentration: {
                    type: 'long',
                  },
                  created_datetime: {
                    type: 'keyword',
                  },
                  normal_tumor_genotype_snp_match: {
                    type: 'keyword',
                  },
                  ribosomal_rna_28s_16s_ratio: {
                    type: 'long',
                  },
                  spectrophotometer_method: {
                    type: 'keyword',
                  },
                  state: {
                    type: 'keyword',
                  },
                  submitter_id: {
                    type: 'keyword',
                  },
                  updated_datetime: {
                    type: 'keyword',
                  },
                  well_number: {
                    type: 'keyword',
                  },
                },
              },
              annotations: {
                type: 'nested',
                properties: {
                  annotation_id: {
                    type: 'keyword',
                  },
                  case_id: {
                    type: 'keyword',
                  },
                  case_submitter_id: {
                    type: 'keyword',
                  },
                  category: {
                    type: 'keyword',
                  },
                  classification: {
                    type: 'keyword',
                  },
                  created_datetime: {
                    type: 'keyword',
                  },
                  creator: {
                    type: 'keyword',
                  },
                  entity_id: {
                    type: 'keyword',
                  },
                  entity_submitter_id: {
                    type: 'keyword',
                  },
                  entity_type: {
                    type: 'keyword',
                  },
                  legacy_created_datetime: {
                    type: 'keyword',
                  },
                  legacy_updated_datetime: {
                    type: 'keyword',
                  },
                  notes: {
                    type: 'keyword',
                  },
                  state: {
                    type: 'keyword',
                  },
                  status: {
                    type: 'keyword',
                  },
                  submitter_id: {
                    type: 'keyword',
                  },
                  updated_datetime: {
                    type: 'keyword',
                  },
                },
              },
              center: {
                properties: {
                  center_id: {
                    type: 'keyword',
                  },
                  center_type: {
                    type: 'keyword',
                  },
                  code: {
                    type: 'keyword',
                  },
                  name: {
                    type: 'keyword',
                  },
                  namespace: {
                    type: 'keyword',
                  },
                  short_name: {
                    type: 'keyword',
                  },
                },
              },
              created_datetime: {
                type: 'keyword',
              },
              creation_datetime: {
                type: 'long',
              },
              is_ffpe: {
                type: 'keyword',
              },
              portion_id: {
                type: 'keyword',
              },
              portion_number: {
                type: 'keyword',
              },
              slides: {
                type: 'nested',
                properties: {
                  annotations: {
                    type: 'nested',
                    properties: {
                      annotation_id: {
                        type: 'keyword',
                      },
                      case_id: {
                        type: 'keyword',
                      },
                      case_submitter_id: {
                        type: 'keyword',
                      },
                      category: {
                        type: 'keyword',
                      },
                      classification: {
                        type: 'keyword',
                      },
                      created_datetime: {
                        type: 'keyword',
                      },
                      creator: {
                        type: 'keyword',
                      },
                      entity_id: {
                        type: 'keyword',
                      },
                      entity_submitter_id: {
                        type: 'keyword',
                      },
                      entity_type: {
                        type: 'keyword',
                      },
                      legacy_created_datetime: {
                        type: 'keyword',
                      },
                      legacy_updated_datetime: {
                        type: 'keyword',
                      },
                      notes: {
                        type: 'keyword',
                      },
                      state: {
                        type: 'keyword',
                      },
                      status: {
                        type: 'keyword',
                      },
                      submitter_id: {
                        type: 'keyword',
                      },
                      updated_datetime: {
                        type: 'keyword',
                      },
                    },
                  },
                  created_datetime: {
                    type: 'keyword',
                  },
                  number_proliferating_cells: {
                    type: 'long',
                  },
                  percent_eosinophil_infiltration: {
                    type: 'long',
                  },
                  percent_granulocyte_infiltration: {
                    type: 'long',
                  },
                  percent_inflam_infiltration: {
                    type: 'long',
                  },
                  percent_lymphocyte_infiltration: {
                    type: 'long',
                  },
                  percent_monocyte_infiltration: {
                    type: 'long',
                  },
                  percent_necrosis: {
                    type: 'long',
                  },
                  percent_neutrophil_infiltration: {
                    type: 'long',
                  },
                  percent_normal_cells: {
                    type: 'long',
                  },
                  percent_stromal_cells: {
                    type: 'long',
                  },
                  percent_tumor_cells: {
                    type: 'long',
                  },
                  percent_tumor_nuclei: {
                    type: 'long',
                  },
                  section_location: {
                    type: 'keyword',
                  },
                  slide_id: {
                    type: 'keyword',
                  },
                  state: {
                    type: 'keyword',
                  },
                  submitter_id: {
                    type: 'keyword',
                  },
                  updated_datetime: {
                    type: 'keyword',
                  },
                },
              },
              state: {
                type: 'keyword',
              },
              submitter_id: {
                type: 'keyword',
              },
              updated_datetime: {
                type: 'keyword',
              },
              weight: {
                type: 'long',
              },
            },
          },
          preservation_method: {
            type: 'keyword',
          },
          sample_id: {
            type: 'keyword',
          },
          sample_type: {
            type: 'keyword',
          },
          sample_type_id: {
            type: 'keyword',
          },
          shortest_dimension: {
            type: 'keyword',
          },
          state: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          time_between_clamping_and_freezing: {
            type: 'keyword',
          },
          time_between_excision_and_freezing: {
            type: 'keyword',
          },
          tissue_type: {
            type: 'keyword',
          },
          tumor_code: {
            type: 'keyword',
          },
          tumor_code_id: {
            type: 'keyword',
          },
          tumor_descriptor: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
        },
      },
      slide_ids: {
        type: 'keyword',
      },
      state: {
        type: 'keyword',
      },
      submitter_aliquot_ids: {
        type: 'keyword',
      },
      submitter_analyte_ids: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      submitter_portion_ids: {
        type: 'keyword',
      },
      submitter_sample_ids: {
        type: 'keyword',
      },
      submitter_slide_ids: {
        type: 'keyword',
      },
      summary: {
        properties: {
          data_categories: {
            type: 'nested',
            properties: {
              data_category: {
                type: 'keyword',
              },
              file_count: {
                type: 'long',
              },
            },
          },
          experimental_strategies: {
            type: 'nested',
            properties: {
              experimental_strategy: {
                type: 'keyword',
              },
              file_count: {
                type: 'long',
              },
            },
          },
          file_count: {
            type: 'long',
          },
          file_size: {
            type: 'long',
          },
        },
      },
      tissue_source_site: {
        properties: {
          bcr_id: {
            type: 'keyword',
          },
          code: {
            type: 'keyword',
          },
          name: {
            type: 'keyword',
          },
          project: {
            type: 'keyword',
          },
          tissue_source_site_id: {
            type: 'keyword',
          },
        },
      },
      updated_datetime: {
        type: 'keyword',
      },
    },
  },
  center: {
    properties: {
      center_id: {
        type: 'keyword',
      },
      center_type: {
        type: 'keyword',
      },
      code: {
        type: 'keyword',
      },
      name: {
        type: 'keyword',
      },
      namespace: {
        type: 'keyword',
      },
      short_name: {
        type: 'keyword',
      },
    },
  },
  created_datetime: {
    type: 'keyword',
  },
  data_category: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  data_format: {
    type: 'keyword',
  },
  data_type: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  downstream_analyses: {
    type: 'nested',
    properties: {
      analysis_id: {
        type: 'keyword',
      },
      analysis_type: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      output_files: {
        type: 'nested',
        properties: {
          access: {
            type: 'keyword',
          },
          created_datetime: {
            type: 'keyword',
          },
          data_category: {
            type: 'keyword',
          },
          data_format: {
            type: 'keyword',
          },
          data_type: {
            type: 'keyword',
          },
          error_type: {
            type: 'keyword',
          },
          experimental_strategy: {
            type: 'keyword',
          },
          file_id: {
            type: 'keyword',
          },
          file_name: {
            type: 'keyword',
          },
          file_size: {
            type: 'long',
          },
          file_state: {
            type: 'keyword',
          },
          md5sum: {
            type: 'keyword',
          },
          platform: {
            type: 'keyword',
          },
          revision: {
            type: 'long',
          },
          state: {
            type: 'keyword',
          },
          state_comment: {
            type: 'keyword',
          },
          submitter_id: {
            type: 'keyword',
          },
          updated_datetime: {
            type: 'keyword',
          },
        },
      },
      state: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      updated_datetime: {
        type: 'keyword',
      },
      workflow_end_datetime: {
        type: 'keyword',
      },
      workflow_link: {
        type: 'keyword',
      },
      workflow_start_datetime: {
        type: 'keyword',
      },
      workflow_type: {
        type: 'keyword',
      },
      workflow_version: {
        type: 'keyword',
      },
    },
  },
  error_type: {
    type: 'keyword',
  },
  experimental_strategy: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  file_autocomplete: {
    type: 'keyword',
    fields: {
      analyzed: {
        type: 'text',
        analyzer: 'autocomplete_analyzed',
        search_analyzer: 'lowercase_keyword',
      },
      lowercase: {
        type: 'text',
        analyzer: 'lowercase_keyword',
      },
      prefix: {
        type: 'text',
        analyzer: 'autocomplete_prefix',
        search_analyzer: 'lowercase_keyword',
      },
    },
  },
  file_id: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  file_name: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  file_size: {
    type: 'long',
  },
  file_state: {
    type: 'keyword',
  },
  index_files: {
    type: 'nested',
    properties: {
      access: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      data_category: {
        type: 'keyword',
      },
      data_format: {
        type: 'keyword',
      },
      data_type: {
        type: 'keyword',
      },
      error_type: {
        type: 'keyword',
      },
      experimental_strategy: {
        type: 'keyword',
      },
      file_id: {
        type: 'keyword',
      },
      file_name: {
        type: 'keyword',
      },
      file_size: {
        type: 'long',
      },
      file_state: {
        type: 'keyword',
      },
      md5sum: {
        type: 'keyword',
      },
      platform: {
        type: 'keyword',
      },
      revision: {
        type: 'long',
      },
      state: {
        type: 'keyword',
      },
      state_comment: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      updated_datetime: {
        type: 'keyword',
      },
    },
  },
  md5sum: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  metadata_files: {
    type: 'nested',
    properties: {
      access: {
        type: 'keyword',
      },
      created_datetime: {
        type: 'keyword',
      },
      data_category: {
        type: 'keyword',
      },
      data_format: {
        type: 'keyword',
      },
      data_type: {
        type: 'keyword',
      },
      error_type: {
        type: 'keyword',
      },
      file_id: {
        type: 'keyword',
      },
      file_name: {
        type: 'keyword',
      },
      file_size: {
        type: 'long',
      },
      file_state: {
        type: 'keyword',
      },
      md5sum: {
        type: 'keyword',
      },
      state: {
        type: 'keyword',
      },
      state_comment: {
        type: 'keyword',
      },
      submitter_id: {
        type: 'keyword',
      },
      type: {
        type: 'keyword',
      },
      updated_datetime: {
        type: 'keyword',
      },
    },
  },
  origin: {
    type: 'keyword',
  },
  platform: {
    type: 'keyword',
  },
  revision: {
    type: 'long',
  },
  state: {
    type: 'keyword',
  },
  state_comment: {
    type: 'keyword',
  },
  submitter_id: {
    type: 'keyword',
    copy_to: ['file_autocomplete'],
  },
  tags: {
    type: 'keyword',
  },
  type: {
    type: 'keyword',
  },
  updated_datetime: {
    type: 'keyword',
  },
};
