def dockerHubRepo = "overture/arranger-test"
def githubRepo = "overture-stack/arranger"
def commit = "UNKNOWN"

pipeline {
    agent {
        kubernetes {
            label 'arranger-executor'
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:12.6.0
    tty: true
  - name: helm
    image: alpine/helm:2.12.3
    tty: true
    command:
    - cat
  - name: docker
    image: docker:18-git
    tty: true
    volumeMounts:
    - mountPath: /var/run/docker.sock
      name: docker-sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
      type: File
"""
        }
    }
    stages {
        stage('Prepare') {
            steps {
                script {
                    commit = sh(returnStdout: true, script: 'git describe --always').trim()
                }
                script {
                    version = sh(returnStdout: true, script: 'cat ./package.json | grep version | cut -d \':\' -f2 | sed -e \'s/"//\' -e \'s/",//\'').trim()
                }
            }
        }
        stage("Build test container") {
          steps {
            container('docker') {
              sh "docker build --no-cache --network=host -f test.Dockerfile -t ${dockerHubRepo}:${commit} ."
            }
          }
        }
        stage('Run tests') {
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh 'docker login -u $USERNAME -p $PASSWORD'
                        // sh "docker run ${dockerHubRepo}:${commit}"
                        sh "docker push ${dockerHubRepo}:${commit}"
                    }
                }
            }
        }
        stage('Build') {
            steps {
                container('node') {
                    sh "npm ci"
                    sh "npm run bootstrap"
                }
            }
        }

        stage('Push edge test container') {
          // when {
          //   branch "develop"
          // }
          steps {
            container('docker') {
              withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                  sh 'docker login -u $USERNAME -p $PASSWORD'
                  sh "docker tag ${dockerHubRepo}:${commit} ${dockerHubRepo}:edge"
                  sh "docker tag ${dockerHubRepo}:${commit} ${dockerHubRepo}:${version}-${commit}"
                  sh "docker push ${dockerHubRepo}:edge"
                  sh "docker push ${dockerHubRepo}:${version}-${commit}"
              }
            }
          }
        }

        stage('Push latest test container') {
          when {
            branch "master"
          }
          steps {
            container('docker') {
              withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                  sh 'docker login -u $USERNAME -p $PASSWORD'
                  sh "docker tag ${dockerHubRepo}:${commit} ${dockerHubRepo}:latest"
                  sh "docker push ${dockerHubRepo}:latest"
                  sh "docker tag ${dockerHubRepo}:${commit} ${dockerHubRepo}:${version}"
                  sh "docker push ${dockerHubRepo}:${commit} ${dockerHubRepo}:${version}"
              }
            }
          }
        }

        stage('Publish tag to npm') {
            // when {
            //     branch "master"
            // }
            steps {
                container('node') {
                    withCredentials([
                        usernamePassword(credentialsId: 'argoGithub', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME'),
                        usernamePassword(credentialsId: 'devops-npm', passwordVariable: 'NPM_PASSWORD', usernameVariable: 'NPM_USERNAME'),
                        usernamePassword(credentialsId: 'devopsargo_email', passwordVariable: 'E  MAIL_PASSWORD', usernameVariable: 'EMAIL')
                    ]) {
                        sh "NPM_EMAIL=${EMAIL} NPM_USERNAME=${NPM_USERNAME} NPM_PASSWORD=${NPM_PASSWORD} npx npm-ci-login"
                        sh "git tag ${version}"
                        sh "git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/${githubRepo} --tags"
                        sh "npm run publish::ci"
                    }
                }
            }
        }
    }
    // post {
    //     unsuccessful {
    //         // i used node   container since it has curl already
    //         container("node") {
    //             script {
    //                 if (env.BRANCH_NAME == "master" || env.BRANCH_NAME == "develop") {
    //                 withCredentials([string(credentialsId: 'JenkinsFailuresSlackChannelURL', variable: 'JenkinsFailuresSlackChannelURL')]) { 
    //                         sh "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Build Failed: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \"}' ${JenkinsFailuresSlackChannelURL}"
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     fixed {
    //         container("node") {
    //             script {
    //                 if (env.BRANCH_NAME == "master" || env.BRANCH_NAME == "develop") {
    //                 withCredentials([string(credentialsId: 'JenkinsFailuresSlackChannelURL', variable: 'JenkinsFailuresSlackChannelURL')]) { 
    //                         sh "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Build Fixed: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \"}' ${JenkinsFailuresSlackChannelURL}"
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // }
}
