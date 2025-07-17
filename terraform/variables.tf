variable "region" {
  description = "AWS region"
  type        = string
  default     = "ap-south-1"
}

variable "cluster_name" {
  description = "ECS Cluster name"
  type        = string
  default     = "codeshare-cluster"
}

variable "gateway_image" {
  description = "Docker image URI for gateway-api"
  type        = string
}

variable "room_image" {
  description = "Docker image URI for room-service"
  type        = string
}

variable "desired_count" {
  description = "Number of ECS tasks per service"
  type        = number
  default     = 1
}

variable "ecs_cpu" {
  description = "CPU units for ECS task"
  type        = string
  default     = "512"
}

variable "ecs_memory" {
  description = "Memory for ECS task in MiB"
  type        = string
  default     = "1024"
}
