#!groovy
properties([
    pipelineTriggers([[$class:"SCMTrigger", scmpoll_spec:"H/2 * * * *"]])
])

pipeline {
  agent { label 'docker-slave' }
  stages{
    stage('Get Code') {
      steps {
          deleteDir()
          checkout scm
      }
    }
    stage('GetOpsScripts') {
      steps {
        slackSend (color: '#ddaa00', message: ":construction_worker: GETTING SCRIPTS:")
        sh '''
        git clone git@github.com:overture-stack/arranger.git
        '''
      }
    }
    stage('Test') {
     steps {
       slackSend (color: '#ddaa00', message: ":construction_worker: TESTING STARTED: (${env.BUILD_URL})")
       sh '''
       dataservice-api/test_stage/test.sh
       '''
       slackSend (color: '#41aa58', message: ":white_check_mark: TESTING COMPLETED: (${env.BUILD_URL})")
     }
     post {
       failure {
         slackSend (color: '#ff0000', message: ":frowning: Test Failed: Branch '${env.BRANCH} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
       }
     }
    }
    stage('Build') {
      steps {
        sh '''
        dataservice-api/build_stage/build.sh
        '''
      }
    }
    stage('Publish') {
      steps {
        sh '''
        dataservice-api/publish_stage/publish.sh
        '''
        slackSend (color: '#41aa58', message: ":arrow_up: PUSHED IMAGE: (${env.BUILD_URL})")
      }
      post {
        failure {
          slackSend (color: '#ff0000', message: ":frowning: Publish Failed: Branch '${env.BRANCH} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
        }
      }
    }
    stage('Deploy Dev') {
      when {
        expression {
          return env.BRANCH_NAME != 'master';
        }
      }
      steps {
        slackSend (color: '#005e99', message: ":deploying_dev: DEPLOYING TO DEVELOPMENT: (${env.BUILD_URL})")
        sh '''
        dataservice-api/deploy_stage/deploy.sh dev
        '''
        slackSend (color: '#41aa58', message: ":white_check_mark: DEPLOYED TO DEVELOPMENT: (${env.BUILD_URL})")
      }
      post {
        failure {
          slackSend (color: '#ff0000', message: ":frowning: Test Failed: Branch '${env.BRANCH} [${env.BUILD_NUMBER}]' (${env.BUILD_URL})")
        }
      }
    }
    stage('Deploy QA') {
      when {
       expression {
           return env.BRANCH_NAME == 'master';
       }
     }
     steps {
       slackSend (color: '#005e99', message: ":deploying_qa: DEPLOYING TO QA: (${env.BUILD_URL})")
       sh '''
       dataservice-api/deploy_stage/deploy.sh qa
       '''
       slackSend (color: '#41aa58', message: ":white_check_mark: DEPLOYED TO QA: (${env.BUILD_URL})")
     }
    }
  }
}
