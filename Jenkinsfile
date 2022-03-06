String podSpec = '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: node
      image: node:16
      tty: true
      env:
        - name: HOME
          value: /home/jenkins/agent
        - name: TEST_ES_HOST
          value: http://localhost:9200
      resources:
        requests:
          memory: 512Mi
          cpu: 1000m
        limits:
          memory: 2048Mi
          cpu: 4000m
    - name: elasticsearch
      image: elasticsearch:7.17.1
      tty: true
      env:
        - name: discovery.type
          value: single-node
        - name: ES_JAVA_OPTS
          value: '-Xms512m -Xmx512m'
      command:
        - cat
      resources:
        requests:
          memory: 512Mi
          cpu: 1024m
        limits:
          memory: 1024Mi
          cpu: 1024m
    - name: docker
      image: docker:20-git
      tty: true
      env:
        - name: DOCKER_HOST
          value: tcp://localhost:2375
        - name: HOME
          value: /home/jenkins/agent
      resources:
        requests:
          memory: 256Mi
          cpu: 100m
        limits:
          memory: 512Mi
          cpu: 1000m
    - name: dind-daemon
      image: docker:18.06-dind
      securityContext:
        privileged: true
        runAsUser: 0
      volumeMounts:
        - name: docker-graph-storage
          mountPath: /var/lib/docker
      resources:
        requests:
          memory: 512Mi
          cpu: 100m
        limits:
          memory: 1024Mi
          cpu: 1500m
  securityContext:
    runAsUser: 1000
  volumes:
  - name: docker-graph-storage
    emptyDir: {}
'''

pipeline {
  agent {
    kubernetes {
      yaml podSpec
    }
  }

  environment {
    dockerHubRepo = 'overture/arranger'
    gitHubRegistry = 'ghcr.io'
    gitHubRepo = 'overture-stack/arranger'
    chartsServer = 'https://overture-stack.github.io/charts-server/'

    commit = sh(
      returnStdout: true,
      script: 'git describe --always'
    ).trim()

    version = sh(
      returnStdout: true,
      script: 'cat lerna.json | ' +
        'grep "version" | ' +
        'cut -d : -f2 | ' +
        "sed \'s:[\",]::g\'"
    ).trim()
  }

  options {
    timestamps()
  }

  stages {
    stage('Build modules') {
      steps {
        container('node') {
          sh 'npm ci'
          sh 'npm run bootstrap'
        }
      }
    }

    stage('Run tests') {
      steps {
        container('elasticsearch') {
          withEnv(['JENKINS_NODE_COOKIE=do_not_kill']) {
            sh 'elasticsearch &'
          }
        }

        container('node') {
          sh 'chmod +x -R ' + env.WORKSPACE
          sh 'docker/test/wait-for-es.sh \$TEST_ES_HOST npm run test'
        }
      }
    }

    stage('Build images') {
      steps {
        container('node') {
          sh 'cd modules/admin-ui && npm run build'
        }

        container('docker') {
          sh "DOCKER_BUILDKIT=1 \
            docker build \
            --target server \
            --network=host \
            -f ./docker/Dockerfile.jenkins \
            -t arranger-server:${commit} ."
        }
      }
    }

    stage('Push images') {
      when {
        anyOf {
          branch 'develop'
          branch 'main'
        }
      }
      parallel {
        stage('pushing images to dockerhub') {
          steps {
            container('docker') {
              withCredentials([usernamePassword(
                credentialsId:'OvertureDockerHub',
                passwordVariable: 'PASSWORD',
                usernameVariable: 'USERNAME'
              )]) {
                sh "docker login -u $USERNAME -p $PASSWORD"

                when {
                  branch 'develop'
                }
                steps {
                  sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:${commit}"
                  sh "docker push ${dockerHubRepo}-server:${commit}"

                  sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:edge"
                  sh "docker push ${dockerHubRepo}-server:edge"
                }

                when {
                  branch 'main'
                }
                steps {
                  sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:${version}"
                  sh "docker push ${dockerHubRepo}-server:${version}"
                  sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:latest"
                  sh "docker push ${dockerHubRepo}-server:latest"
                }
              }
            }
          }
        }

        stage('pushing images to github') {
          steps {
            container('docker') {
              withCredentials([usernamePassword(
                credentialsId:'OvertureBioGithub',
                passwordVariable: 'PASSWORD',
                usernameVariable: 'USERNAME'
              )]) {
                sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"

                when {
                  branch 'develop'
                }
                steps {
                  sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
                  sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${commit}"

                  sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:edge"
                  sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:edge"
                }

                when {
                  branch 'main'
                }
                steps {
                  sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}"
                  sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}"

                  sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:latest"
                  sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:latest"
                }
              }
            }
          }
        }
      }
    }

    // stage('Push edge images') {
    //   when {
    //     branch 'develop'
    //   }
    //   steps {
    //     container('docker') {
    //       // dockerhub
    //       withCredentials([usernamePassword(
    //         credentialsId:'OvertureDockerHub',
    //         passwordVariable: 'PASSWORD',
    //         usernameVariable: 'USERNAME'
    //       )]) {
    //         sh "docker login -u $USERNAME -p $PASSWORD"

    //       // server:commit tag
    //         sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:${commit}"
    //         sh "docker push ${dockerHubRepo}-server:${commit}"
    //       // server:version tag
    //         sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:edge"
    //         sh "docker push ${dockerHubRepo}-server:edge"
    //       }

    //     // github
    //       withCredentials([usernamePassword(
    //         credentialsId:'OvertureBioGithub',
    //         passwordVariable: 'PASSWORD',
    //         usernameVariable: 'USERNAME'
    //       )]) {
    //         sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"

    //       // server:commit tag
    //         sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
    //         sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
    //       // server:version tag
    //         sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:edge"
    //         sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:edge"
    //       }
    //     }
    //   }
    // }

    // stage('Push latest images') {
    //   when {
    //     branch 'main'
    //   }
    //   steps {
    //     container('docker') {
    //       // dockerhub
    //       withCredentials([usernamePassword(
    //         credentialsId:'OvertureDockerHub',
    //         passwordVariable: 'PASSWORD',
    //         usernameVariable: 'USERNAME'
    //       )]) {
    //         sh "docker login -u $USERNAME -p $PASSWORD"

    //       // server:commit tag
    //         sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:${version}"
    //         sh "docker push ${dockerHubRepo}-server:${version}"
    //       // server:version tag
    //         sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:latest"
    //         sh "docker push ${dockerHubRepo}-server:latest"
    //       }

    //     // github
    //       withCredentials([usernamePassword(
    //         credentialsId:'OvertureBioGithub',
    //         passwordVariable: 'PASSWORD',
    //         usernameVariable: 'USERNAME'
    //       )]) {
    //         sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"

    //       // server:commit tag
    //         sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}"
    //         sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}"
    //       // server:version tag
    //         sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:latest"
    //         sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:latest"
    //       }
    //     }
    //   }
    // }

    stage('Publish tag to npm') {
      when {
        branch 'main'
      }
      steps {
        container('node') {
          withCredentials([
            string(credentialsId: 'OvertureNPMAutomationToken', variable: 'NPM_TOKEN')
          ]) {
            script {
              // we still want to run the platform deploy even if this fails, hence try-catch
              try {
                sh 'git reset --hard HEAD'
                sh 'git pull --tags'
                sh "npm config set '//registry.npmjs.org/:_authToken' \"${NPM_TOKEN}\""
                sh 'PUBLISH_DECLARATIONS=true npm run publish::ci'
              } catch (err) {
                echo 'There was an error while publishing packages'
              }
            }
          }
        }
      }
    }

  //   stage('Deploy to Overture QA') {
  //     when {
  //       branch 'develop'
  //     }
  //     steps {
  //       build(job: '/Overture.bio/provision/helm', parameters: [
  //         [$class: 'StringParameterValue', name: 'OVERTURE_ENV', value: 'qa' ],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_CHART_NAME', value: 'arranger'],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_RELEASE_NAME', value: 'arranger'],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_HELM_CHART_VERSION', value: ''], // use latest chart
  //         [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REPO_URL', value: chartsServer],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REUSE_VALUES', value: "false" ],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_ARGS_LINE', value: "--set-string apiImage.tag=${commit} --set-string uiImage.tag=${commit}" ]
  //       ])
  //     }
  //   }

  //   stage('Deploy to Overture Staging') {
  //     when {
  //       branch 'master'
  //     }
  //     steps {
  //       build(job: '/Overture.bio/provision/helm', parameters: [
  //         [$class: 'StringParameterValue', name: 'OVERTURE_ENV', value: 'staging' ],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_CHART_NAME', value: 'arranger'],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_RELEASE_NAME', value: 'arranger'],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_HELM_CHART_VERSION', value: ''], // use latest chart
  //         [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REPO_URL', value: chartsServer],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REUSE_VALUES', value: "false" ],
  //         [$class: 'StringParameterValue', name: 'OVERTURE_ARGS_LINE', value: "--set-string apiImage.tag=${version} --set-string uiImage.tag=${version}" ]
  //       ])
  //     }
  //   }
  // }
  }

  // post {
  //   fixed {
  //     stages {
  //       stage('fixed') {
  //         when {
  //           anyOf {
  //             branch 'develop'
  //             branch 'main'
  //           }
  //         }
  //         steps {
  //           withCredentials([string(
  //             credentialsId: 'JenkinsFailuresSlackChannelURL',
  //             variable: 'JenkinsFailuresSlackChannelURL'
  //           )]) {
  //             container('node') {
  //               sh "curl \
  //                 -X POST \
  //                 -H 'Content-type: application/json' \
  //                 --data '{ \
  //                   \"text\":\"Build Fixed: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \" \
  //                 }' \
  //                 ${JenkinsFailuresSlackChannelURL}"
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }

  //   unsuccessful {
  //     steps {
  //       // withCredentials([string(
  //       //   credentialsId: 'JenkinsFailuresSlackChannelURL',
  //       //   variable: 'JenkinsFailuresSlackChannelURL'
  //       // )]) {
  //           //   sh "curl \
  //           //     -X POST \
  //           //     -H 'Content-type: application/json' \
  //           //     --data '{ \
  //           //     \"text\":\"Build Failed: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \" \
  //           //     }' \
  //           //     ${JenkinsFailuresSlackChannelURL}"
  //           // }
  //       // }
  //     }
  //   }
  // }
}

