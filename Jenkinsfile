def gitHubRepo = "overture-stack/arranger"
def gitHubRegistry = "ghcr.io"
def dockerHubRepo = "overture/arranger"
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
    image: node:13.13.0
    tty: true
    env:
    - name: HOME
      value: /home/jenkins/agent
  - name: docker
    image: docker:18-git
    tty: true
    env:
    - name: DOCKER_HOST
      value: tcp://localhost:2375
    - name: HOME
      value: /home/jenkins/agent
  - name: dind-daemon
    image: docker:18.06-dind
    securityContext:
      privileged: true
      runAsUser: 0
    volumeMounts:
    - name: docker-graph-storage
      mountPath: /var/lib/docker
  securityContext:
    runAsUser: 1000
  volumes:
  - name: docker-graph-storage
    emptyDir: {}
"""
        }
    }
    stages {
        stage('Diagnostics') {
            steps {
                container('docker') {
                    sh "printenv; id; cat /etc/passwd"
                }
                container('node') {
                    sh "printenv; id; cat /etc/passwd"
                }
            }
        }

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
					}
					sh "docker build --network=host --target test -f Dockerfile -t ${dockerHubRepo}-test:${commit} ."
				}
			}
		}

        stage('Run tests') {
            steps {
                container('docker') {
                    sh "docker run ${dockerHubRepo}-test:${commit}"
                }
            }
        }

		stage("Build server and ui images") {
			steps {
				container('docker') {
					withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
						sh 'docker login -u $USERNAME -p $PASSWORD'
					}
					sh "docker build --network=host --target server -f Dockerfile -t ${dockerHubRepo}-server:${commit} ."
					sh "docker build --network=host --target ui -f Dockerfile -t ${dockerHubRepo}-ui:${commit} ."
				}
				container('docker') {
					withCredentials([usernamePassword(credentialsId:'OvertureBioGithub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
						sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"
					}
					sh "docker build --network=host --target server -f Dockerfile -t ${gitHubRegistry}/${gitHubRepo}-server:${commit} ."
					sh "docker build --network=host --target ui -f Dockerfile -t ${gitHubRegistry}/${gitHubRepo}-ui:${commit} ."
				}
			}
		}

        stage('Push images') {
            when {
                branch "legacy"
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'OvertureDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh "docker login -u $USERNAME -p $PASSWORD"
                    }
					sh "docker push ${dockerHubRepo}-server:${commit}"
					sh "docker push ${dockerHubRepo}-ui:${commit}"
                    sh "docker tag ${dockerHubRepo}-server:${commit} ${dockerHubRepo}-server:${version}"
                    sh "docker push ${dockerHubRepo}-server:${version}"
                    sh "docker tag ${dockerHubRepo}-server:${commit} ${dockerHubRepo}-server:${version}-${commit}"
                    sh "docker push ${dockerHubRepo}-server:${version}-${commit}"
                    sh "docker tag ${dockerHubRepo}-ui:${commit} ${dockerHubRepo}-ui:${version}"
                    sh "docker push ${dockerHubRepo}-ui:${version}"
                    sh "docker tag ${dockerHubRepo}-ui:${commit} ${dockerHubRepo}-ui:${version}-${commit}"
                    sh "docker push ${dockerHubRepo}-ui:${version}-${commit}"
                }
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'OvertureBioGithub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"
                    }
					sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
					sh "docker push ${gitHubRegistry}/${gitHubRepo}-ui:${commit}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}-${commit}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}-${commit}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-ui:${commit} ${gitHubRegistry}/${gitHubRepo}-ui:${version}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-ui:${version}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-ui:${commit} ${gitHubRegistry}/${gitHubRepo}-ui:${version}-${commit}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-ui:${version}-${commit}"
                }
            }
        }

        stage('Publish tag to npm') {
            when {
                branch "legacy"
            }
            steps {
                container('node') {
                    withCredentials([
                        string(credentialsId: "OvertureNPMAutomationToken", variable: 'NPM_TOKEN')
                    ]) {
                        script {
                            // we still want to run the platform deploy even if this fails, hence try-catch
                            try {
                                sh "git pull --tags"
                                sh "npm ci"
                                sh "npm config set unsafe-perm true"
                                sh "npm run bootstrap"
                                sh "npm config set '//registry.npmjs.org/:_authToken' \"${NPM_TOKEN}\""
                                sh "npm run publish::ci"
                            } catch (err) {
                                echo "There was an error while publishing packages"
                            }
                        }
                    }
                }
            }
        }
    }
}
