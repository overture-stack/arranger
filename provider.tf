provider "aws" {
  region = "${var.region}"
}

data "terraform_remote_state" "remote-state" {
    backend = "s3"
    config {
        bucket =          "${var.bucket}"
        key =             "${var.organzation}-${var.environment}-us-east-1-${var.application}-rsf"
        region =          "${var.region}"
    }
}
