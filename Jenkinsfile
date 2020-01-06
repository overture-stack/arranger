def dockerHubRepo = "overture/arranger"
def githubRepo = "overture-stack/arranger"
def commit = "UNKNOWN"

pipeline {
    agent {
        kubernetes {
            label 'gateway-executor'
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
        stage('Build') {
            steps {
                container('node') {
                    sh "npm ci"
                    sh "npm run bootstrap"
                }
            }
        }
        stage('Test') {
            steps {
                container('node') {
                    sh "npm run test"
                }
            }
        }

        stage('Deploy to argo-dev') {
            // when {
            //     branch "master"
            // }
            steps {
                container('node') {
                  withCredentials([
                    usernamePassword(credentialsId: 'argoGithub', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME'),
                    usernamePassword(credentialsId: 'devops-npm', passwordVariable: 'NPM_PASSWORD', usernameVariable: 'NPM_USERNAME'),
                        usernamePassword(credentialsId: 'devopsargo_email', passwordVariable: 'EMAIL_PASSWORD', usernameVariable: 'EMAIL')
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
