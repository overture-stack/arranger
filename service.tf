data aws_ecs_cluster "app-cluster" {
  cluster_name = "${var.organization}-apps-${var.environment}-${var.region}-ecs"
}

resource "aws_iam_role" "ecs_service" {
  name = "ecs_service_linked_role-${var.service_name}-${var.environment}"

  assume_role_policy = <<EOF
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

data aws_route53_zone "kids-first-io-zone" {
    name         = "kids-first.io."
    private_zone = false
}

resource aws_route53_record "application_route53_record" {
  zone_id = "${data.aws_route53_zone.kids-first-io-zone.zone_id}"
  name    = "${var.environment != "prd" ? format("%s-%s",var.service_name, var.environment) : var.service_name}"
  type    = "CNAME"
  ttl     = "300"
  records = ["${aws_alb.kf-application-lb.dns_name}"]
}

resource "aws_iam_role_policy" "ecs_service" {
  role = "${aws_iam_role.ecs_service.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "elasticloadbalancing:DeregisterInstancesFromLoadBalancer",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:Describe*",
        "elasticloadbalancing:RegisterInstancesWithLoadBalancer",
        "elasticloadbalancing:RegisterTargets"
      ],
      "Resource": "*"
    }
  ]
}
EOF
}


data aws_vpc "apps-vpc" {
  filter {
    name="tag:Name"
    values=["${var.organization}-apps-${var.environment}-${var.region}-vpc"]
  }
}


resource "aws_security_group" "lb_sg" {
    name = "lb_sg-${var.service_name}-${var.environment}"
    description = "Allows all traffic"
    vpc_id = "${data.aws_vpc.apps-vpc.id}"

    # TODO: do we need to allow ingress besides TCP 80 and 443?
    ingress {
        from_port = 80
        to_port = 80
        protocol = "TCP"
        cidr_blocks = ["10.0.0.0/8"]
    }

    ingress {
        from_port = 80
        to_port = 80
        protocol = "TCP"
        cidr_blocks = ["${var.chop_cidr}"]
    }

    # TODO: this probably only needs egress to the ECS security group.
    egress {
        from_port = 0
        to_port = 0
        protocol = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }
}

resource aws_security_group "kf-service-security-group" {
    name = "service-sg-${var.service_name}-${var.environment}"
    description = "Allow traffic from lb"
    vpc_id = "${data.aws_vpc.apps-vpc.id}"

    ingress {
        from_port = 80
        to_port = 80
        protocol = "TCP"
        security_groups = ["${aws_security_group.lb_sg.id}"]
    }

    egress {
        from_port = 0
        to_port = 0
        protocol = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }

}

resource "aws_alb_target_group" "kf-application-tg" {
  name     = "${var.organization}-${var.service_name}-${var.environment}"
  port     = 80
  protocol = "HTTP"
  vpc_id   = "${data.aws_vpc.apps-vpc.id}"
  target_type = "ip"
  stickiness = {
    type = "lb_cookie"
    enabled = false
  }
}

resource "aws_alb_listener" "front_end" {
  load_balancer_arn = "${aws_alb.kf-application-lb.arn}"
  port              = "80"
  protocol          = "HTTP"
  default_action {
      target_group_arn = "${aws_alb_target_group.kf-application-tg.id}"
      type             = "forward"
    }
}

resource "aws_ecs_service" "kf-application-service" {
  name            = "${var.organization}-${var.service_name}-${var.environment}"
  cluster         = "${data.aws_ecs_cluster.app-cluster.id}"
  task_definition = "${aws_ecs_task_definition.kf-application-task.arn}"
  desired_count   = 1
  launch_type     = "FARGATE"
  #iam_role        = "${aws_iam_role.ecs_service.arn}"
  depends_on = [
    "aws_iam_role_policy.ecs_service",
    "aws_alb_listener.front_end"
  ]

  load_balancer {
    target_group_arn = "${aws_alb_target_group.kf-application-tg.id}"
    container_name = "${var.service_name}-${var.environment}-container"
    container_port = 80
  }

  network_configuration {
    subnets = ["${data.aws_subnet.subnet1.id}","${data.aws_subnet.subnet2.id}","${data.aws_subnet.subnet3.id}","${data.aws_subnet.subnet4.id}"]
    security_groups = ["${aws_security_group.kf-service-security-group.id}"]
  }
}
