data "template_file" "task_definition" {
  template = "${file("definitions/container-definition.json")}"
  vars {
    log_group_region         = "${var.region}"
    log_group_name = "${aws_cloudwatch_log_group.app.name}"
    image = "${var.image}"
    environment = "${var.environment}"
    service_name = "${var.service_name}"
    task_role_arn = "${var.task_role_arn}"
    vault_role = "${var.vault_role}"
    vault_url     = "${var.vault_url}"
    pg_host      = "${var.pg_host}"
    db_secret_path = "${var.db_secret_path}"
    pg_db_name     = "${var.pg_db_name}"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name = "apps-${var.environment}/${var.application}"
}

resource "aws_ecs_task_definition" "kf-application-task" {
  family                = "${var.service_name}"
  task_role_arn = "${var.task_role_arn}"
  container_definitions = "${data.template_file.task_definition.rendered}"
  execution_role_arn    = "arn:aws:iam::538745987955:role/ecsTaskExecutionRole"
  network_mode = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu = "0.5vCPU"
  memory = "1024"
}
