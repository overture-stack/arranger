
.. code-block::

  PUT file_centric
  {}

  PUT file_centric 
  {
    "mappings":{
      "file_centric": {
        "_meta": {
          "kf-dataservice-version": "1.6.0"
        },
        "properties": {
          "acl": {
            "type": "keyword"
          },
          "availability": {
            "type": "keyword"
          },
          "controlled_access": {
            "type": "boolean"
          },
          "created_at": {
            "type": "date",
            "format": "yyyy-MM-dd HH:mm:ss.SSSSSS||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'T'HH:mm:ss.SSSSSS+HH:mm"
          },
          "data_type": {
            "type": "keyword"
          },
          "experiment_strategies": {
            "type": "keyword"
          },
          "external_id": {
            "type": "keyword"
          },
          "file_format": {
            "type": "keyword"
          },
          "file_name": {
            "type": "keyword"
          },
          "instrument_models": {
            "type": "keyword"
          },
          "is_harmonized": {
            "type": "boolean"
          },
          "is_paired_end": {
            "type": "boolean"
          },
          "kf_id": {
            "type": "keyword"
          },
          "latest_did": {
            "type": "keyword"
          },
          "modified_at": {
            "type": "date",
            "format": "yyyy-MM-dd HH:mm:ss.SSSSSS||yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'T'HH:mm:ss.SSSSSS+HH:mm"
          },
          "participants": {
            "type": "nested",
            "properties": {
              "affected_status": {
                "type": "boolean"
              },
              "alias_group": {
                "type": "keyword"
              },
              "available_data_types": {
                "type": "keyword"
              },
              "biospecimens": {
                "type": "nested",
                "properties": {
                  "age_at_event_days": {
                    "type": "integer"
                  },
                  "analyte_type": {
                    "type": "keyword"
                  },
                  "composition": {
                    "type": "keyword"
                  },
                  "concentration_mg_per_ml": {
                    "type": "float"
                  },
                  "consent_type": {
                    "type": "keyword"
                  },
                  "dbgap_consent_code": {
                    "type": "keyword"
                  },
                  "external_aliquot_id": {
                    "type": "keyword"
                  },
                  "external_sample_id": {
                    "type": "keyword"
                  },
                  "kf_id": {
                    "type": "keyword"
                  },
                  "method_of_sample_procurement": {
                    "type": "keyword"
                  },
                  "ncit_id_anatomical_site": {
                    "type": "keyword"
                  },
                  "ncit_id_tissue_type": {
                    "type": "keyword"
                  },
                  "sequencing_center_id": {
                    "type": "keyword"
                  },
                  "shipment_date": {
                    "type": "keyword"
                  },
                  "shipment_origin": {
                    "type": "keyword"
                  },
                  "source_text_anatomical_site": {
                    "type": "keyword"
                  },
                  "source_text_tissue_type": {
                    "type": "keyword"
                  },
                  "source_text_tumor_descriptor": {
                    "type": "keyword"
                  },
                  "spatial_descriptor": {
                    "type": "keyword"
                  },
                  "uberon_id_anatomical_site": {
                    "type": "keyword"
                  },
                  "volume_ul": {
                    "type": "float"
                  }
                }
              },
              "diagnoses": {
                "type": "nested",
                "properties": {
                  "age_at_event_days": {
                    "type": "integer"
                  },
                  "diagnosis": {
                    "type": "keyword"
                  },
                  "diagnosis_category": {
                    "type": "keyword"
                  },
                  "external_id": {
                    "type": "keyword"
                  },
                  "icd_id_diagnosis": {
                    "type": "keyword"
                  },
                  "kf_id": {
                    "type": "keyword"
                  },
                  "mondo_id_diagnosis": {
                    "type": "keyword"
                  },
                  "ncit_id_diagnosis": {
                    "type": "keyword"
                  },
                  "source_text_diagnosis": {
                    "type": "keyword"
                  },
                  "source_text_tumor_location": {
                    "type": "keyword"
                  },
                  "spatial_descriptor": {
                    "type": "keyword"
                  },
                  "uberon_id_tumor_location": {
                    "type": "keyword"
                  }
                }
              },
              "diagnosis_category": {
                "type": "keyword"
              },
              "ethnicity": {
                "type": "keyword"
              },
              "external_id": {
                "type": "keyword"
              },
              "family": {
                "properties": {
                  "family_compositions": {
                    "type": "nested",
                    "properties": {
                      "available_data_types": {
                        "type": "keyword"
                      },
                      "composition": {
                        "type": "keyword"
                      },
                      "family_members": {
                        "type": "nested",
                        "properties": {
                          "affected_status": {
                            "type": "boolean"
                          },
                          "alias_group": {
                            "type": "keyword"
                          },
                          "available_data_types": {
                            "type": "keyword"
                          },
                          "diagnoses": {
                            "type": "nested",
                            "properties": {
                              "age_at_event_days": {
                                "type": "integer"
                              },
                              "diagnosis": {
                                "type": "keyword"
                              },
                              "diagnosis_category": {
                                "type": "keyword"
                              },
                              "external_id": {
                                "type": "keyword"
                              },
                              "icd_id_diagnosis": {
                                "type": "keyword"
                              },
                              "kf_id": {
                                "type": "keyword"
                              },
                              "mondo_id_diagnosis": {
                                "type": "keyword"
                              },
                              "ncit_id_diagnosis": {
                                "type": "keyword"
                              },
                              "source_text_diagnosis": {
                                "type": "keyword"
                              },
                              "source_text_tumor_location": {
                                "type": "keyword"
                              },
                              "spatial_descriptor": {
                                "type": "keyword"
                              },
                              "uberon_id_tumor_location": {
                                "type": "keyword"
                              }
                            }
                          },
                          "diagnosis_category": {
                            "type": "keyword"
                          },
                          "ethnicity": {
                            "type": "keyword"
                          },
                          "external_id": {
                            "type": "keyword"
                          },
                          "gender": {
                            "type": "keyword"
                          },
                          "is_proband": {
                            "type": "boolean"
                          },
                          "kf_id": {
                            "type": "keyword"
                          },
                          "outcome": {
                            "properties": {
                              "age_at_event_days": {
                                "type": "integer"
                              },
                              "disease_related": {
                                "type": "keyword"
                              },
                              "external_id": {
                                "type": "keyword"
                              },
                              "kf_id": {
                                "type": "keyword"
                              },
                              "vital_status": {
                                "type": "keyword"
                              }
                            }
                          },
                          "phenotype": {
                            "properties": {
                              "age_at_event_days": {
                                "type": "integer"
                              },
                              "ancestral_hpo_ids": {
                                "type": "keyword"
                              },
                              "external_id": {
                                "type": "keyword"
                              },
                              "hpo_phenotype_not_observed": {
                                "type": "keyword"
                              },
                              "hpo_phenotype_observed": {
                                "type": "keyword"
                              },
                              "hpo_phenotype_observed_text": {
                                "type": "keyword"
                              },
                              "shared_hpo_ids": {
                                "type": "keyword"
                              },
                              "snomed_phenotype_not_observed": {
                                "type": "keyword"
                              },
                              "snomed_phenotype_observed": {
                                "type": "keyword"
                              },
                              "source_text_phenotype": {
                                "type": "keyword"
                              }
                            }
                          },
                          "race": {
                            "type": "keyword"
                          },
                          "relationship": {
                            "type": "keyword"
                          }
                        }
                      },
                      "shared_hpo_ids": {
                        "type": "keyword"
                      }
                    }
                  },
                  "family_id": {
                    "type": "text",
                    "fields": {
                      "keyword": {
                        "type": "keyword",
                        "ignore_above": 256
                      }
                    }
                  },
                  "father_id": {
                    "type": "keyword"
                  },
                  "mother_id": {
                    "type": "keyword"
                  }
                }
              },
              "family_id": {
                "type": "keyword"
              },
              "gender": {
                "type": "keyword"
              },
              "is_proband": {
                "type": "boolean"
              },
              "kf_id": {
                "type": "keyword"
              },
              "outcome": {
                "properties": {
                  "age_at_event_days": {
                    "type": "integer"
                  },
                  "disease_related": {
                    "type": "keyword"
                  },
                  "external_id": {
                    "type": "keyword"
                  },
                  "kf_id": {
                    "type": "keyword"
                  },
                  "vital_status": {
                    "type": "keyword"
                  }
                }
              },
              "phenotype": {
                "properties": {
                  "age_at_event_days": {
                    "type": "integer"
                  },
                  "ancestral_hpo_ids": {
                    "type": "keyword"
                  },
                  "external_id": {
                    "type": "keyword"
                  },
                  "hpo_phenotype_not_observed": {
                    "type": "keyword"
                  },
                  "hpo_phenotype_observed": {
                    "type": "keyword"
                  },
                  "hpo_phenotype_observed_text": {
                    "type": "keyword"
                  },
                  "snomed_phenotype_not_observed": {
                    "type": "keyword"
                  },
                  "snomed_phenotype_observed": {
                    "type": "keyword"
                  },
                  "source_text_phenotype": {
                    "type": "keyword"
                  }
                }
              },
              "race": {
                "type": "keyword"
              },
              "study": {
                "properties": {
                  "attribution": {
                    "type": "text"
                  },
                  "data_access_authority": {
                    "type": "keyword"
                  },
                  "external_id": {
                    "type": "keyword"
                  },
                  "investigator_id": {
                    "type": "keyword"
                  },
                  "kf_id": {
                    "type": "keyword"
                  },
                  "name": {
                    "type": "keyword"
                  },
                  "release_status": {
                    "type": "keyword"
                  },
                  "short_name": {
                    "type": "keyword"
                  },
                  "version": {
                    "type": "keyword"
                  }
                }
              }
            }
          },
          "platforms": {
            "type": "keyword"
          },
          "reference_genome": {
            "type": "keyword"
          },
          "sequencing_experiments": {
            "type": "nested",
            "properties": {
              "experiment_date": {
                "type": "keyword"
              },
              "experiment_strategy": {
                "type": "keyword"
              },
              "external_id": {
                "type": "keyword"
              },
              "instrument_model": {
                "type": "keyword"
              },
              "is_paired_end": {
                "type": "boolean"
              },
              "kf_id": {
                "type": "keyword"
              },
              "library_name": {
                "type": "keyword"
              },
              "library_strand": {
                "type": "keyword"
              },
              "max_insert_size": {
                "type": "integer"
              },
              "mean_depth": {
                "type": "float"
              },
              "mean_insert_size": {
                "type": "float"
              },
              "mean_read_length": {
                "type": "float"
              },
              "platform": {
                "type": "keyword"
              },
              "sequencing_center_id": {
                "type": "keyword"
              },
              "total_reads": {
                "type": "integer"
              }
            }
          },
          "size": {
            "type": "long"
          }
        }
      }
    }
  }