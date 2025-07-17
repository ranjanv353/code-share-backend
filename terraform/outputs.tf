output "alb_dns" {
  description = "ALB DNS name"
  value       = aws_lb.codeshare_alb.dns_name
}
