variable "service_name" {
  default = "default"
}
variable "environment" {
}
variable "application" {
  default = "not_set"
}
variable "organization" {
  default="kf"
}
variable "region" {
  default="us-east-1"
}
variable "chop_cidr" {}
variable "bucket" {}
variable "owner" {}
variable "organzation" {}
variable "image" {
}
variable "task_role_arn" {
}
variable "vault_url" {}
variable "pg_host" {}
variable "db_secret_path" {
  default=""
}
variable "pg_db_name" {
  default = ""
}
variable "vault_role" {}
