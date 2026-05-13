#!/usr/bin/env python3

import os
import re
import shutil
import smtplib
import subprocess
import time
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import boto3
from botocore.exceptions import ClientError


ALLOWED_DB_NAME_CHARS = re.compile(r"^[a-zA-Z0-9_]+$")
ALLOWED_USER_CHARS = re.compile(r"^[a-zA-Z0-9_]+$")
ALLOWED_HOST_CHARS = re.compile(r"^[a-zA-Z0-9._-]+$")

_UNSET = object()


def get_env_variable(name, required=True, default=_UNSET):
    value = os.getenv(name)

    if value is None:
        if default is not _UNSET:
            return default
        if required:
            raise EnvironmentError(f"Environment variable {name} is required but not set")
        return None

    return value


def generate_backup_filename():
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    return f"backup_{timestamp}.sql.gz"


def validate_db_name(db_name, allowed_names=None):
    if not db_name or not isinstance(db_name, str):
        raise ValueError("Database name cannot be empty")

    if len(db_name) > 64:
        raise ValueError("Database name exceeds maximum length (64 characters)")

    if not ALLOWED_DB_NAME_CHARS.match(db_name):
        raise ValueError(
            f"Invalid database name: '{db_name}'. "
            "Only alphanumeric characters and underscores are allowed."
        )

    if allowed_names is not None:
        if isinstance(allowed_names, str):
            allowed_list = [name.strip() for name in allowed_names.split(",")]
        else:
            allowed_list = allowed_names

        allowed_list = [name for name in allowed_list if name]
        if allowed_list and db_name not in allowed_list:
            raise ValueError(
                f"Database '{db_name}' is not in the allowed list. "
                f"Allowed databases: {', '.join(allowed_list)}"
            )

    return True


def validate_db_user(user):
    if not user or not isinstance(user, str):
        raise ValueError("Database username cannot be empty")

    if len(user) > 32:
        raise ValueError("Username exceeds maximum length (32 characters)")

    if not ALLOWED_USER_CHARS.match(user):
        raise ValueError(
            f"Invalid username: '{user}'. "
            "Only alphanumeric characters and underscores are allowed."
        )

    return True


def validate_db_host(host):
    if not host or not isinstance(host, str):
        raise ValueError("Database host cannot be empty")

    if len(host) > 255:
        raise ValueError("Hostname exceeds maximum length (255 characters)")

    if not ALLOWED_HOST_CHARS.match(host):
        raise ValueError(
            f"Invalid host: '{host}'. "
            "Only alphanumeric characters, dots, underscores, and hyphens are allowed."
        )

    return True


def validate_db_port(port):
    try:
        port_num = int(port)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid port: '{port}'. Must be a numeric value.")

    if port_num < 1 or port_num > 65535:
        raise ValueError(f"Port {port_num} is out of valid range (1-65535)")

    return port_num


def check_disk_space(path="/", threshold_gb=1.0):
    try:
        statvfs = os.statvfs(path)
        free_bytes = statvfs.f_frsize * statvfs.f_bavail
        free_gb = free_bytes / (1024 ** 3)
        return free_gb, free_gb < threshold_gb
    except Exception as e:
        raise RuntimeError(f"Failed to check disk space: {e}")


def send_warning_email(email_config, subject, message):
    try:
        msg = MIMEMultipart()
        msg["From"] = email_config["from_addr"]
        msg["To"] = email_config["to_addr"]
        msg["Subject"] = subject

        msg.attach(MIMEText(message, "plain"))

        server = smtplib.SMTP(
            email_config["host"],
            email_config["port"],
        )
        server.ehlo()

        if email_config.get("use_tls"):
            server.starttls()
            server.ehlo()

        if email_config.get("username") and email_config.get("password"):
            server.login(email_config["username"], email_config["password"])

        text = msg.as_string()
        server.sendmail(
            email_config["from_addr"],
            email_config["to_addr"].split(","),
            text,
        )
        server.quit()
        print("Warning email sent successfully")
    except Exception as e:
        raise RuntimeError(f"Failed to send email: {e}")


def mysqldump_to_gzip(db_config, output_path, allowed_db_names=None):
    validate_db_host(db_config["host"])
    validate_db_port(db_config["port"])
    validate_db_user(db_config["user"])
    validate_db_name(db_config["name"], allowed_names=allowed_db_names)

    if shutil.which("mysqldump") is None:
        raise RuntimeError("mysqldump command not found. Please install MySQL client tools.")

    if shutil.which("gzip") is None:
        raise RuntimeError("gzip command not found. Please install gzip.")

    cmd = [
        "mysqldump",
        "--host", db_config["host"],
        "--port", str(db_config["port"]),
        "--user", db_config["user"],
        db_config["name"],
    ]

    env = os.environ.copy()
    if db_config["password"]:
        env["MYSQL_PWD"] = db_config["password"]

    mysqldump_result = subprocess.run(
        cmd,
        env=env,
        capture_output=True,
        check=False,
    )
    mysqldump_exit_code = mysqldump_result.returncode
    mysqldump_stderr = mysqldump_result.stderr

    if mysqldump_exit_code != 0:
        error_msg = f"mysqldump failed with exit code {mysqldump_exit_code}"
        if mysqldump_stderr:
            error_msg += f"\nError output:\n{mysqldump_stderr.decode()}"
        raise RuntimeError(error_msg)

    gzip_result = subprocess.run(
        ["gzip"],
        input=mysqldump_result.stdout,
        capture_output=True,
        check=False,
    )
    gzip_exit_code = gzip_result.returncode
    gzip_stderr = gzip_result.stderr

    if gzip_exit_code != 0:
        error_msg = f"gzip failed with exit code {gzip_exit_code}"
        if gzip_stderr:
            error_msg += f"\nError output:\n{gzip_stderr.decode()}"
        raise RuntimeError(error_msg)

    with open(output_path, "wb") as f:
        f.write(gzip_result.stdout)

    env.pop("MYSQL_PWD", None)


def upload_to_s3(file_path, s3_config):
    s3 = boto3.client(
        "s3",
        aws_access_key_id=s3_config["access_key"],
        aws_secret_access_key=s3_config["secret_key"],
        region_name=s3_config.get("region"),
    )

    bucket_name = s3_config["bucket"]
    key = s3_config.get("prefix", "").rstrip("/")
    filename = os.path.basename(file_path)
    if key:
        key = f"{key}/{filename}"
    else:
        key = filename

    try:
        s3.upload_file(file_path, bucket_name, key)
        return key
    except ClientError as e:
        raise RuntimeError(f"Failed to upload to S3: {e}")


def cleanup_old_s3_backups(s3_config, retention_days=7):
    s3 = boto3.client(
        "s3",
        aws_access_key_id=s3_config["access_key"],
        aws_secret_access_key=s3_config["secret_key"],
        region_name=s3_config.get("region"),
    )

    bucket_name = s3_config["bucket"]
    prefix = s3_config.get("prefix", "").rstrip("/")
    if prefix:
        prefix = f"{prefix}/"

    cutoff_date = datetime.now() - timedelta(days=retention_days)
    deleted_count = 0

    try:
        paginator = s3.get_paginator("list_objects_v2")
        page_iterator = paginator.paginate(Bucket=bucket_name, Prefix=prefix)

        for page in page_iterator:
            if "Contents" not in page:
                continue

            for obj in page["Contents"]:
                key = obj["Key"]
                last_modified = obj["LastModified"].replace(tzinfo=None)

                if last_modified < cutoff_date:
                    s3.delete_object(Bucket=bucket_name, Key=key)
                    print(f"Deleted old backup: s3://{bucket_name}/{key}")
                    deleted_count += 1

        print(f"Cleanup complete: deleted {deleted_count} backup(s) older than {retention_days} days")
        return deleted_count

    except ClientError as e:
        raise RuntimeError(f"Failed to cleanup old backups: {e}")


def main():
    db_config = {
        "host": get_env_variable("DB_HOST", default="localhost"),
        "port": int(get_env_variable("DB_PORT", default="3306")),
        "user": get_env_variable("DB_USER"),
        "password": get_env_variable("DB_PASSWORD"),
        "name": get_env_variable("DB_NAME"),
    }

    allowed_db_names = get_env_variable("ALLOWED_DB_NAMES", required=False)

    s3_access_key = get_env_variable("AWS_ACCESS_KEY_ID", required=False)
    s3_secret_key = get_env_variable("AWS_SECRET_ACCESS_KEY", required=False)
    s3_bucket = get_env_variable("S3_BUCKET", required=False)
    
    s3_config = None
    if s3_access_key and s3_secret_key and s3_bucket:
        s3_config = {
            "access_key": s3_access_key,
            "secret_key": s3_secret_key,
            "bucket": s3_bucket,
            "region": get_env_variable("AWS_REGION", default=None),
            "prefix": get_env_variable("S3_PREFIX", default=""),
        }
    else:
        print("S3 configuration not provided - will skip upload and keep local backup")

    email_config = {
        "from_addr": get_env_variable("EMAIL_FROM", required=False),
        "to_addr": get_env_variable("EMAIL_TO", required=False),
        "host": get_env_variable("SMTP_HOST", required=False),
        "port": int(get_env_variable("SMTP_PORT", default="587")),
        "use_tls": get_env_variable("SMTP_USE_TLS", default="true").lower() == "true",
        "username": get_env_variable("SMTP_USERNAME", required=False),
        "password": get_env_variable("SMTP_PASSWORD", required=False),
    }

    retention_days = int(get_env_variable("BACKUP_RETENTION_DAYS", default="7"))
    disk_threshold_gb = float(get_env_variable("DISK_SPACE_THRESHOLD_GB", default="1.0"))

    local_file_path = generate_backup_filename()

    try:
        print(f"Checking disk space...")
        free_gb, is_low = check_disk_space(
            path=os.path.dirname(os.path.abspath(local_file_path)) or "/",
            threshold_gb=disk_threshold_gb,
        )
        print(f"Free disk space: {free_gb:.2f} GB")

        if is_low:
            warning_msg = (
                f"WARNING: Low disk space detected on backup server.\n"
                f"Current free space: {free_gb:.2f} GB\n"
                f"Threshold: {disk_threshold_gb} GB\n"
                f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            )
            print(f"Low disk space warning: {warning_msg}")

            if email_config["from_addr"] and email_config["to_addr"] and email_config["host"]:
                send_warning_email(
                    email_config,
                    "[WARNING] Low Disk Space - MySQL Backup Server",
                    warning_msg,
                )
            else:
                print("Email configuration incomplete - skipping warning email")

        print(f"Starting MySQL backup...")
        mysqldump_to_gzip(db_config, local_file_path, allowed_db_names=allowed_db_names)
        print(f"Backup created: {local_file_path}")

        if s3_config:
            print(f"Uploading to S3 bucket {s3_config['bucket']}...")
            uploaded_key = upload_to_s3(local_file_path, s3_config)
            print(f"Upload successful: s3://{s3_config['bucket']}/{uploaded_key}")

            os.remove(local_file_path)
            print(f"Removed local backup file: {local_file_path}")

            print(f"Cleaning up old backups on S3 (retention: {retention_days} days)...")
            cleanup_old_s3_backups(s3_config, retention_days=retention_days)
        else:
            print(f"Skipping S3 upload - local backup kept at: {local_file_path}")
            print("Backup process completed successfully!")

    except Exception as e:
        print(f"Error: {e}")
        if os.path.exists(local_file_path):
            os.remove(local_file_path)
        raise


if __name__ == "__main__":
    main()
