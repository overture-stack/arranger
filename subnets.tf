data "aws_subnet" "subnet1" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*private*1a"]
  }
}

data "aws_subnet" "subnet2" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*private*1b"]
  }
}

data "aws_subnet" "subnet3" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*private*1c"]
  }
}

data "aws_subnet" "subnet4" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*private*1e"]
  }
}

data "aws_subnet" "publicSubnet1" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*public*1a"]
  }
}

data "aws_subnet" "publicSubnet2" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*public*1b"]
  }
}

data "aws_subnet" "publicSubnet3" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*public*1c"]
  }
}

data "aws_subnet" "publicSubnet4" {
  filter {
    name = "tag:Name"
    values = ["*apps*${var.environment}*public*1e"]
  }
}
