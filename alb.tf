data aws_s3_bucket "lb_logs" {
  bucket = "${var.organization}-elb-${var.environment}-logging-bucket"
}

resource "aws_alb" "kf-application-lb" {
  name            = "${var.organization}-${var.application}-${var.environment}-alb"
  internal        = false
  security_groups = ["${aws_security_group.lb_sg.id}"]
  subnets         = ["${data.aws_subnet.publicSubnet1.id}","${data.aws_subnet.publicSubnet2.id}","${data.aws_subnet.publicSubnet3.id}","${data.aws_subnet.publicSubnet4.id}"]
  enable_deletion_protection = false

  access_logs {
    enabled = true
    bucket = "${data.aws_s3_bucket.lb_logs.id}"
    prefix = "${var.organization}-${var.application}"
  }

  tags {
    Name        = "${var.organization}"
    Environment = "${var.environment}"
    Owner       = "${var.owner}"
  }
}
