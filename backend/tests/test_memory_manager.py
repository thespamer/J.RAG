"""
Tests for the MemoryManager class.
"""
import os
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from core.memory_manager import MemoryManager

def create_temp_file(path: Path, size_bytes: int = 1024):
    """Helper to create a temporary file with specific size."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'x' * size_bytes)

class TestMemoryManager:
    def test_init(self, clean_test_env):
        """Test MemoryManager initialization."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        assert manager.cache_dir == clean_test_env["cache_dir"]
        assert manager.offload_dir == clean_test_env["offload_dir"]
        assert manager.MODEL_DISK_SPACE == 10 * 1024 * 1024 * 1024  # 10GB

    def test_check_available_memory(self, clean_test_env):
        """Test memory availability check."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        total_gb, available_gb = manager.check_available_memory()
        assert total_gb > 0
        assert available_gb > 0
        assert total_gb >= available_gb

    def test_get_disk_space_info(self, clean_test_env):
        """Test disk space information retrieval."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        info = manager.get_disk_space_info()
        assert "total" in info
        assert "free" in info
        assert "used" in info
        assert info["total"] > 0
        assert info["free"] > 0
        assert info["used"] >= 0

    def test_clean_corrupted_cache(self, clean_test_env):
        """Test cache cleaning functionality."""
        # Create test files
        cache_dir = Path(clean_test_env["cache_dir"])
        test_files = [
            ("normal.txt", 1024),  # 1KB normal file
            ("empty.txt", 0),  # Empty file
            ("temp.tmp", 512),  # Temporary file
            (".DS_Store", 128),  # Hidden file
            ("large.bin", 1024 * 1024)  # 1MB file
        ]
        
        for filename, size in test_files:
            create_temp_file(cache_dir / filename, size)

        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        
        # Run cleanup
        manager.clean_corrupted_cache()
        
        # Verify cleanup results
        assert not (cache_dir / "empty.txt").exists()  # Empty file should be removed
        assert not (cache_dir / "temp.tmp").exists()  # Temp file should be removed
        assert not (cache_dir / ".DS_Store").exists()  # Hidden file should be removed
        assert (cache_dir / "normal.txt").exists()  # Normal file should remain
        assert (cache_dir / "large.bin").exists()  # Large file should remain

    def test_prepare_for_model_loading(self, clean_test_env):
        """Test model loading preparation."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        
        # Create some test files to clean
        cache_dir = Path(clean_test_env["cache_dir"])
        create_temp_file(cache_dir / "temp.tmp", 1024)
        create_temp_file(cache_dir / "empty.txt", 0)
        
        # Run preparation
        manager.prepare_for_model_loading()
        
        # Verify preparation results
        assert not (cache_dir / "temp.tmp").exists()
        assert not (cache_dir / "empty.txt").exists()
        assert os.path.exists(clean_test_env["cache_dir"])
        assert os.path.exists(clean_test_env["offload_dir"])

    def test_get_directory_size(self, clean_test_env):
        """Test directory size calculation."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        
        # Create test files with known sizes
        cache_dir = Path(clean_test_env["cache_dir"])
        files = {
            "file1.txt": 1024,  # 1KB
            "file2.txt": 2048,  # 2KB
            "subdir/file3.txt": 4096  # 4KB in subdirectory
        }
        
        total_size = 0
        for filepath, size in files.items():
            path = cache_dir / filepath
            path.parent.mkdir(parents=True, exist_ok=True)
            create_temp_file(path, size)
            total_size += size
        
        # Calculate and verify size
        calculated_size = manager._get_directory_size(clean_test_env["cache_dir"])
        assert calculated_size == total_size

    @pytest.mark.parametrize("disk_space,should_raise", [
        (11 * 1024 * 1024 * 1024, False),  # 11GB - sufficient
        (5 * 1024 * 1024 * 1024, True),    # 5GB - insufficient
    ])
    def test_disk_space_check(self, clean_test_env, disk_space, should_raise):
        """Test disk space checking with different scenarios."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        
        with patch('core.memory_manager.MemoryManager.get_disk_space_info') as mock_space:
            mock_space.return_value = {
                "total": disk_space * 2,
                "free": disk_space,
                "used": disk_space
            }
            
            if should_raise:
                with pytest.raises(RuntimeError, match="Insufficient disk space"):
                    manager.prepare_for_model_loading()
            else:
                manager.prepare_for_model_loading()  # Should not raise

    def test_error_handling(self, clean_test_env):
        """Test error handling in MemoryManager."""
        manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        
        # Test with non-existent directory
        non_existent = "/non/existent/path"
        size = manager._get_directory_size(non_existent)
        assert size == 0  # Should return 0 for non-existent directory
        
        # Test with permission error
        with patch('os.scandir') as mock_scandir:
            mock_scandir.side_effect = PermissionError()
            size = manager._get_directory_size(clean_test_env["cache_dir"])
            assert size == 0  # Should handle permission error gracefully
