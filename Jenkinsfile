String podSpec = '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: node
      image: node:14
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
      image: elasticsearch:7.6.0
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
        - name: TEST_ES_HOST
          value: http://localhost:9200
      resources:
        requests:
          memory: 256Mi
          cpu: 100m
        limits:
          memory: 512Mi
          cpu: 1000m
    - name: dind-daemon
      image: docker:18-dind
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
          memory: 1536Mi
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

          sh "DOCKER_BUILDKIT=1 \
            docker build \
            --target ui \
            --network=host \
            -f ./docker/Dockerfile.jenkins \
            -t arranger-ui:${commit} ."
        }
      }
    }

    stage('Push images') {
      when {
        anyOf {
          branch 'legacy'
        }
      }
      steps {
        container('docker') {
          // dockerhub
          withCredentials([usernamePassword(
            credentialsId:'OvertureDockerHub',
            passwordVariable: 'PASSWORD',
            usernameVariable: 'USERNAME'
          )]) {
            sh "docker login -u $USERNAME -p $PASSWORD"

            // server:commit tag
            sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:${commit}"
            sh "docker push ${dockerHubRepo}-server:${commit}"

            // (admin) ui:commit tag
            sh "docker tag arranger-ui:${commit} ${dockerHubRepo}-ui:${commit}"
            sh "docker push ${dockerHubRepo}-ui:${commit}"

            script {
              if (env.BRANCH_NAME ==~ 'legacy') {
                // server:version tag
                sh "docker tag arranger-server:${commit} ${dockerHubRepo}-server:${version}"
                sh "docker push ${dockerHubRepo}-server:${version}"

                // (admin) ui:version tag
                sh "docker tag arranger-ui:${commit} ${dockerHubRepo}-ui:${version}"
                sh "docker push ${dockerHubRepo}-ui:${version}"
              }
            }
          }

          // github
          withCredentials([usernamePassword(
            credentialsId:'OvertureBioGithub',
            passwordVariable: 'PASSWORD',
            usernameVariable: 'USERNAME'
          )]) {
            sh "docker login ${gitHubRegistry} -u $USERNAME -p $PASSWORD"

            // server:commit tag
            sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${commit}"
            sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${commit}"

            // (admin) ui:commit tag
            sh "docker tag arranger-ui:${commit} ${gitHubRegistry}/${gitHubRepo}-ui:${commit}"
            sh "docker push ${gitHubRegistry}/${gitHubRepo}-ui:${commit}"

            script {
              if (env.BRANCH_NAME ==~ 'legacy') {
                // server:version tag
                sh "docker tag arranger-server:${commit} ${gitHubRegistry}/${gitHubRepo}-server:${version}"
                sh "docker push ${gitHubRegistry}/${gitHubRepo}-server:${version}"

                // (admin) ui:version tag
                sh "docker tag arranger-ui:${commit} ${gitHubRegistry}/${gitHubRepo}-ui:${version}"
                sh "docker push ${gitHubRegistry}/${gitHubRepo}-ui:${version}"
              }
            }
          }
        }
      }
    }

    stage('Publish tag to npm') {
      when {
        branch 'legacy'
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
                sh 'npm run publish::ci'
              } catch (err) {
                echo 'There was an error while publishing packages'
              }
            }
          }
        }
      }
    }

    stage('Deploy to Overture QA') {
      when {
        branch 'legacy'
      }
      steps {
        build(job: '/Overture.bio/provision/helm', parameters: [
          [$class: 'StringParameterValue', name: 'OVERTURE_ENV', value: 'qa' ],
          [$class: 'StringParameterValue', name: 'OVERTURE_CHART_NAME', value: 'arranger'],
          [$class: 'StringParameterValue', name: 'OVERTURE_RELEASE_NAME', value: 'arranger'],
          [$class: 'StringParameterValue', name: 'OVERTURE_HELM_CHART_VERSION', value: ''], // use latest
          [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REPO_URL', value: chartsServer],
          [$class: 'StringParameterValue', name: 'OVERTURE_HELM_REUSE_VALUES', value: 'false'],
          [$class: 'StringParameterValue', name: 'OVERTURE_ARGS_LINE', value: "--set-string apiImage.tag=${commit} --set-string uiImage.tag=${commit}"]
        ])
      }
    }
  }

  post {
    fixed {
      withCredentials([string(
        credentialsId: 'OvertureSlackJenkinsWebhookURL',
        variable: 'fixed_slackChannelURL'
      )]) {
        container('node') {
          script {
            if (env.BRANCH_NAME ==~ 'legacy') {
              sh "curl \
                -X POST \
                -H 'Content-type: application/json' \
                --data '{ \
                  \"text\":\"Build Fixed: ${env.JOB_NAME} [Build ${env.BUILD_NUMBER}](${env.BUILD_URL}) \" \
                }' \
                ${fixed_slackChannelURL}"
            }
          }
        }
      }
    }

    unsuccessful {
      withCredentials([string(
        credentialsId: 'OvertureSlackJenkinsWebhookURL',
        variable: 'failed_slackChannelURL'
      )]) {
        container('node') {
          script {
            if (env.BRANCH_NAME ==~ 'legacy') {
              sh "curl \
                -X POST \
                -H 'Content-type: application/json' \
                --data '{ \
                  \"text\":\"Build Failed: ${env.JOB_NAME} [Build ${env.BUILD_NUMBER}](${env.BUILD_URL}) \" \
                }' \
                ${failed_slackChannelURL}"
            }
          }
        }
      }
    }
  }
}
