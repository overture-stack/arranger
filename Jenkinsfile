def dockerHubRepo = "overture/arranger-test"
def serverDockerhubRepo = "overture/arranger-server"
def uiDockerhubRepo = "overture/arranger-ui"
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
                    version = sh(returnStdout: true, script: 'cat ./lerna.json | grep \\"version\\" | cut -d \':\' -f2 | sed -e \'s/"//\' -e \'s/",//\'').trim()
                }
            }
        }
		stage("Build test container") {
			steps {
				container('docker') {
					withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
						sh 'docker login -u $USERNAME -p $PASSWORD'
						sh "docker build --network=host --target test -f Dockerfile -t ${dockerHubRepo}:${commit} ."
					}
				}
			}
		}

        stage('Run tests') {
            steps {
                container('docker') {
                  sh "docker run ${dockerHubRepo}:${commit}"
                }
            }
        }

		stage("Build server container") {
			steps {
				container('docker') {
					withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
						sh 'docker login -u $USERNAME -p $PASSWORD'
						sh "docker build --network=host --target server -f Dockerfile -t ${serverDockerhubRepo}:${commit} ."
						sh "docker push ${serverDockerhubRepo}:${commit}"
					}
				}
			}
		}

		stage("Build ui container") {
			steps {
				container('docker') {
					withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
						sh 'docker login -u $USERNAME -p $PASSWORD'
						sh "docker build --network=host --target ui -f Dockerfile -t ${uiDockerhubRepo}:${commit} ."
						sh "docker push ${uiDockerhubRepo}:${commit}"
					}
				}
			}
		}

        stage('Push edge containers') {
            when {
              branch "develop"
            }
            parallel {
                stage('Push edge server container') {
                    steps {
                        container('docker') {
                            withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                                sh 'docker login -u $USERNAME -p $PASSWORD'
                                sh "docker tag ${serverDockerhubRepo}:${commit} ${serverDockerhubRepo}:edge"
                                sh "docker push ${serverDockerhubRepo}:edge"
                                sh "docker tag ${serverDockerhubRepo}:${commit} ${serverDockerhubRepo}:${version}-${commit}"
                                sh "docker push ${serverDockerhubRepo}:${version}-${commit}"
                            }
                        }
                    }
                }
                stage('Push edge ui container') {
                    steps {
                        container('docker') {
                            withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                                sh 'docker login -u $USERNAME -p $PASSWORD'
                                sh "docker tag ${uiDockerhubRepo}:${commit} ${uiDockerhubRepo}:edge"
                                sh "docker push ${uiDockerhubRepo}:edge"
                                sh "docker tag ${uiDockerhubRepo}:${commit} ${uiDockerhubRepo}:${version}-${commit}"
                                sh "docker push ${uiDockerhubRepo}:${version}-${commit}"
                            }
                        }
                    }
                }
            }
        }

        stage('Push latest containers') {
            when {
                branch "master"
            }
            parallel {
                stage('Push latest server container') {
                    steps {
                        container('docker') {
                            withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                                sh 'docker login -u $USERNAME -p $PASSWORD'
                                sh "docker tag ${serverDockerhubRepo}:${commit} ${serverDockerhubRepo}:latest"
                                sh "docker push ${serverDockerhubRepo}:latest"
                                sh "docker tag ${serverDockerhubRepo}:${commit} ${serverDockerhubRepo}:${version}"
                                sh "docker push ${serverDockerhubRepo}:${version}"
                            }
                        }
                    }
                }
                stage('Push latest ui container') {
                    steps {
                        container('docker') {
                            withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                                sh 'docker login -u $USERNAME -p $PASSWORD'
                                sh "docker tag ${uiDockerhubRepo}:${commit} ${uiDockerhubRepo}:latest"
                                sh "docker push ${uiDockerhubRepo}:latest"
                                sh "docker tag ${uiDockerhubRepo}:${commit} ${uiDockerhubRepo}:${version}"
                                sh "docker push ${uiDockerhubRepo}:${version}"
                            }
                        }
                    }
                }
            }
        }

        stage('Publish tag to npm') {
            when {
                branch "master"
            }
            steps {
                container('node') {
                    withCredentials([
                        usernamePassword(credentialsId: 'OvertureBioNPM', passwordVariable: 'NPM_PASSWORD', usernameVariable: 'NPM_USERNAME'),
                        string(credentialsId: 'OvertureBioContact', variable: 'EMAIL'),
                        usernamePassword(credentialsId: 'OvertureBioGithub', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME')
                    ]) {
                        sh "git pull --tags"
                        sh "npm ci"
                        sh "npm config set unsafe-perm true"
                        sh "npm run bootstrap"
                        sh "NPM_EMAIL=${EMAIL} NPM_USERNAME=${NPM_USERNAME} NPM_PASSWORD=${NPM_PASSWORD} npx npm-ci-login"
                        sh "npm run publish::ci"
                    }
                }
            }
        }
    }
    post {
        unsuccessful {
            // i used node   container since it has curl already
            container("node") {
                script {
                    if (env.BRANCH_NAME == "master" || env.BRANCH_NAME == "develop") {
                    withCredentials([string(credentialsId: 'JenkinsFailuresSlackChannelURL', variable: 'JenkinsFailuresSlackChannelURL')]) { 
                            sh "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Build Failed: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \"}' ${JenkinsFailuresSlackChannelURL}"
                        }
                    }
                }
            }
        }
        fixed {
            container("node") {
                script {
                    if (env.BRANCH_NAME == "master" || env.BRANCH_NAME == "develop") {
                    withCredentials([string(credentialsId: 'JenkinsFailuresSlackChannelURL', variable: 'JenkinsFailuresSlackChannelURL')]) { 
                            sh "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Build Fixed: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \"}' ${JenkinsFailuresSlackChannelURL}"
                        }
                    }
                }
            }
        }
    }
}
