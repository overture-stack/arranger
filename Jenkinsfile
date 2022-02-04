def dockerHubRepo = "overture/arranger"
def gitHubRegistry = "ghcr.io"
def gitHubRepo = "overture-stack/arranger"
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
    image: node:16
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
                    withCredentials([usernamePassword(credentialsId:'OvertureBioGithub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"
                    }
                    sh "docker build --network=host --target server -f Dockerfile -t ${gitHubRegistry}/${gitHubRepo}-server:${commit} ."
                }
            }
        }

        stage('Push edge images') {
            when {
                branch "develop"
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'OvertureBioGithub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"
                    }
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:edge"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:edge"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}-${commit}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}-${commit}"
                }
            }
        }

        stage('Push latest images') {
            when {
                branch "main"
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'OvertureBioGithub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"
                    }
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:latest"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:latest"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}"
                    sh "docker tag ${gitHubRegistry}/${gitHubRepo}-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}-${commit}"
                    sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}-${commit}"
                }
            }
        }

        stage('Publish tag to npm') {
            when {
                branch "main"
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

        // stage('Deploy to Overture QA') {
        //     when {
        //         branch "develop"
        //     }
        //     steps {
        //         build(job: "/Overture.bio/provision/helm", parameters: [
        //             [$class: 'StringParameterValue', name: 'OVERTURE_ENV', value: 'qa' ],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_CHART_NAME', value: 'arranger'],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_RELEASE_NAME', value: 'arranger'],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_HELM_CHART_VERSION', value: ''], // use latest
        //             [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REPO_URL', value: "https://overture-stack.github.io/charts-server/"],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REUSE_VALUES', value: "false" ],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_ARGS_LINE', value: "--set-string apiImage.tag=${version}-${commit} --set-string uiImage.tag=${version}-${commit}" ]
        //         ])
        //     }
        // }

        // stage('Deploy to Overture Staging') {
        //     when {
        //         branch "master"
        //     }
        //     steps {
        //         build(job: "/Overture.bio/provision/helm", parameters: [
        //             [$class: 'StringParameterValue', name: 'OVERTURE_ENV', value: 'staging' ],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_CHART_NAME', value: 'arranger'],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_RELEASE_NAME', value: 'arranger'],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_HELM_CHART_VERSION', value: ''], // use latest
        //             [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REPO_URL', value: "https://overture-stack.github.io/charts-server/"],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REUSE_VALUES', value: "false" ],
        //             [$class: 'StringParameterValue', name: 'OVERTURE_ARGS_LINE', value: "--set-string apiImage.tag=${version}-${commit} --set-string uiImage.tag=${version}-${commit}" ]
        //         ])
        //     }
        // }
    }

    post {
        unsuccessful {
            // using the existing node container as it has curl already
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
