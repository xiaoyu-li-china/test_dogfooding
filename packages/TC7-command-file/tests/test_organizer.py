import os
import json
import shutil
import tempfile
import pytest
from pathlib import Path
from datetime import datetime

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

import organizer


class TestLoadRules:
    def test_load_rules_from_valid_json(self, tmp_path):
        rules_content = {
            "rules": [
                {"folder": "Images", "extensions": [".jpg", ".png"]},
                {"folder": "Docs", "extensions": [".pdf"]}
            ]
        }
        rules_file = tmp_path / "rules.json"
        with open(rules_file, "w") as f:
            json.dump(rules_content, f)
        
        config = organizer.load_rules(str(rules_file))
        
        assert "rules" in config
        assert len(config["rules"]) == 2
        assert config["rules"][0]["folder"] == "Images"
    
    def test_load_rules_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            organizer.load_rules("non_existent_rules.json")
    
    def test_load_rules_invalid_json(self, tmp_path):
        invalid_file = tmp_path / "invalid.json"
        with open(invalid_file, "w") as f:
            f.write("{ invalid json }")
        
        with pytest.raises(json.JSONDecodeError):
            organizer.load_rules(str(invalid_file))


class TestGetTargetPath:
    def test_default_rules_image_extension(self):
        config = {}
        file_path = Path("test.jpg")
        
        target_path = organizer.get_target_path(file_path, ".jpg", config)
        
        assert str(target_path) == "Images"
    
    def test_default_rules_unknown_extension(self):
        config = {}
        file_path = Path("test.xyz")
        
        target_path = organizer.get_target_path(file_path, ".xyz", config)
        
        assert str(target_path) == "Others"
    
    def test_custom_rules_match(self):
        config = {
            "rules": [
                {"folder": "MyImages", "extensions": [".jpg", ".png"]}
            ]
        }
        file_path = Path("photo.jpg")
        
        target_path = organizer.get_target_path(file_path, ".jpg", config)
        
        assert str(target_path) == "MyImages"
    
    def test_custom_rules_case_insensitive(self):
        config = {
            "rules": [
                {"folder": "MyImages", "extensions": [".JPG", ".PNG"]}
            ]
        }
        file_path = Path("photo.jpg")
        
        target_path = organizer.get_target_path(file_path, ".jpg", config)
        
        assert str(target_path) == "MyImages"
    
    def test_custom_rules_no_match_falls_to_others(self):
        config = {
            "rules": [
                {"folder": "Images", "extensions": [".jpg"]}
            ]
        }
        file_path = Path("test.pdf")
        
        target_path = organizer.get_target_path(file_path, ".pdf", config)
        
        assert str(target_path) == "Others"
    
    def test_date_subfolder_pattern(self, tmp_path):
        test_file = tmp_path / "test.jpg"
        test_file.write_text("content")
        
        config = {
            "rules": [
                {
                    "folder": "Images",
                    "extensions": [".jpg"],
                    "subfolder": {
                        "type": "date",
                        "pattern": "%Y-%m"
                    }
                }
            ]
        }
        
        target_path = organizer.get_target_path(test_file, ".jpg", config)
        expected_month = datetime.now().strftime("%Y-%m")
        
        assert str(target_path) == f"Images/{expected_month}"
    
    def test_date_subfolder_nested_pattern(self, tmp_path):
        test_file = tmp_path / "video.mp4"
        test_file.write_text("content")
        
        config = {
            "rules": [
                {
                    "folder": "Videos",
                    "extensions": [".mp4"],
                    "subfolder": {
                        "type": "date",
                        "pattern": "%Y/%m/%d"
                    }
                }
            ]
        }
        
        target_path = organizer.get_target_path(test_file, ".mp4", config)
        expected_path = datetime.now().strftime("%Y/%m/%d")
        
        assert str(target_path) == f"Videos/{expected_path}"


class TestOrganizeDirectory:
    def test_dry_run_does_not_move_files(self, tmp_path):
        file1 = tmp_path / "test.jpg"
        file2 = tmp_path / "doc.pdf"
        file1.write_text("content")
        file2.write_text("content")
        
        organizer.organize_directory(tmp_path, dry_run=True, config={})
        
        assert file1.exists()
        assert file2.exists()
        assert not (tmp_path / "Images").exists()
        assert not (tmp_path / "Documents").exists()
    
    def test_dry_run_returns_moved_list(self, tmp_path):
        file1 = tmp_path / "test.jpg"
        file2 = tmp_path / "doc.pdf"
        file1.write_text("content")
        file2.write_text("content")
        
        moved = organizer.organize_directory(tmp_path, dry_run=True, config={})
        
        assert len(moved) == 2
        assert any("test.jpg" in str(m["source"]) for m in moved)
        assert any("doc.pdf" in str(m["source"]) for m in moved)
    
    def test_creates_target_folder_if_not_exists(self, tmp_path):
        test_file = tmp_path / "image.png"
        test_file.write_text("content")
        
        organizer.organize_directory(tmp_path, dry_run=False, config={})
        
        images_dir = tmp_path / "Images"
        assert images_dir.exists()
        assert images_dir.is_dir()
        assert not test_file.exists()
        assert (images_dir / "image.png").exists()
    
    def test_organizes_files_by_extension(self, tmp_path):
        files = [
            ("photo.jpg", "Images"),
            ("report.pdf", "Documents"),
            ("data.csv", "Spreadsheets"),
            ("song.mp3", "Audio"),
            ("archive.zip", "Archives"),
            ("script.py", "Code"),
            ("unknown.xyz", "Others")
        ]
        
        for filename, _ in files:
            (tmp_path / filename).write_text("content")
        
        organizer.organize_directory(tmp_path, dry_run=False, config={})
        
        for filename, folder in files:
            expected_path = tmp_path / folder / filename
            assert expected_path.exists(), f"{filename} not found in {folder}"
    
    def test_duplicate_file_renaming(self, tmp_path):
        images_dir = tmp_path / "Images"
        images_dir.mkdir()
        existing_file = images_dir / "photo.jpg"
        existing_file.write_text("existing")
        
        new_file = tmp_path / "photo.jpg"
        new_file.write_text("new")
        
        organizer.organize_directory(tmp_path, dry_run=False, config={})
        
        assert existing_file.exists()
        assert existing_file.read_text() == "existing"
        
        renamed_file = images_dir / "photo_1.jpg"
        assert renamed_file.exists()
        assert renamed_file.read_text() == "new"
        
        assert not new_file.exists()
    
    def test_multiple_duplicates_sequential_renaming(self, tmp_path):
        images_dir = tmp_path / "Images"
        images_dir.mkdir()
        (images_dir / "photo.jpg").write_text("original")
        (images_dir / "photo_1.jpg").write_text("first")
        (images_dir / "photo_2.jpg").write_text("second")
        
        new_file = tmp_path / "photo.jpg"
        new_file.write_text("third")
        
        organizer.organize_directory(tmp_path, dry_run=False, config={})
        
        assert (images_dir / "photo.jpg").exists()
        assert (images_dir / "photo_1.jpg").exists()
        assert (images_dir / "photo_2.jpg").exists()
        assert (images_dir / "photo_3.jpg").exists()
        assert not new_file.exists()
    
    def test_skips_script_itself(self):
        real_organizer_path = Path(organizer.__file__).resolve()
        assert not (real_organizer_path.parent / "Code").exists() or \
               not (real_organizer_path.parent / "Code" / real_organizer_path.name).exists()
    
    def test_with_custom_rules(self, tmp_path):
        file1 = tmp_path / "photo.jpg"
        file2 = tmp_path / "data.pdf"
        file1.write_text("content")
        file2.write_text("content")
        
        custom_config = {
            "rules": [
                {"folder": "MyPics", "extensions": [".jpg"]},
                {"folder": "MyDocs", "extensions": [".pdf"]}
            ]
        }
        
        organizer.organize_directory(tmp_path, dry_run=False, config=custom_config)
        
        assert (tmp_path / "MyPics" / "photo.jpg").exists()
        assert (tmp_path / "MyDocs" / "data.pdf").exists()
        assert not (tmp_path / "Images").exists()
    
    def test_with_date_subfolder_custom_rules(self, tmp_path):
        test_file = tmp_path / "photo.jpg"
        test_file.write_text("content")
        
        custom_config = {
            "rules": [
                {
                    "folder": "Images",
                    "extensions": [".jpg"],
                    "subfolder": {
                        "type": "date",
                        "pattern": "%Y-%m"
                    }
                }
            ]
        }
        
        organizer.organize_directory(tmp_path, dry_run=False, config=custom_config)
        
        expected_month = datetime.now().strftime("%Y-%m")
        expected_path = tmp_path / "Images" / expected_month / "photo.jpg"
        assert expected_path.exists()
    
    def test_creates_nested_directories(self, tmp_path):
        test_file = tmp_path / "video.mp4"
        test_file.write_text("content")
        
        custom_config = {
            "rules": [
                {
                    "folder": "Videos",
                    "extensions": [".mp4"],
                    "subfolder": {
                        "type": "date",
                        "pattern": "%Y/%m"
                    }
                }
            ]
        }
        
        organizer.organize_directory(tmp_path, dry_run=False, config=custom_config)
        
        expected_year = datetime.now().strftime("%Y")
        expected_month = datetime.now().strftime("%m")
        expected_path = tmp_path / "Videos" / expected_year / expected_month / "video.mp4"
        assert expected_path.exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
