from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
import os
import psutil

class AnalyticsManager:
    def __init__(self):
        self.data_dir = 'data/analytics'
        os.makedirs(self.data_dir, exist_ok=True)
        
    def _get_date_range(self, start_date: Optional[str], end_date: Optional[str]):
        """Get date range for analytics"""
        if not start_date:
            start = datetime.now() - timedelta(days=30)
        else:
            start = datetime.fromisoformat(start_date)
            
        if not end_date:
            end = datetime.now()
        else:
            end = datetime.fromisoformat(end_date)
            
        return start, end
        
    def _load_data(self, date: datetime) -> Dict:
        """Load analytics data for a specific date"""
        date_str = date.strftime('%Y-%m-%d')
        file_path = os.path.join(self.data_dir, f"{date_str}.json")
        
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                return json.load(f)
        return {
            'date': date_str,
            'usage': {
                'total_requests': 0,
                'total_tokens': 0,
                'total_documents': 0,
                'total_workflows': 0
            },
            'performance': {
                'avg_response_time': 0,
                'avg_memory_usage': 0,
                'avg_cpu_usage': 0,
                'error_count': 0
            }
        }
        
    def _save_data(self, date: datetime, data: Dict):
        """Save analytics data for a specific date"""
        date_str = date.strftime('%Y-%m-%d')
        file_path = os.path.join(self.data_dir, f"{date_str}.json")
        
        with open(file_path, 'w') as f:
            json.dump(data, f)
            
    def log_request(self, endpoint: str, response_time: float,
                   tokens: int = 0, error: bool = False):
        """Log an API request"""
        now = datetime.now()
        data = self._load_data(now)
        
        # Update usage stats
        data['usage']['total_requests'] += 1
        data['usage']['total_tokens'] += tokens
        
        # Update performance stats
        current_count = data['usage']['total_requests']
        avg_time = data['performance']['avg_response_time']
        data['performance']['avg_response_time'] = (
            (avg_time * (current_count - 1) + response_time) / current_count
        )
        
        if error:
            data['performance']['error_count'] += 1
            
        # Get system stats
        cpu_percent = psutil.cpu_percent()
        memory = psutil.virtual_memory()
        
        # Update system stats
        data['performance']['avg_cpu_usage'] = (
            (data['performance']['avg_cpu_usage'] * (current_count - 1) + cpu_percent)
            / current_count
        )
        data['performance']['avg_memory_usage'] = (
            (data['performance']['avg_memory_usage'] * (current_count - 1) + memory.percent)
            / current_count
        )
        
        self._save_data(now, data)
        
    def get_usage_stats(self, start_date: Optional[str] = None,
                       end_date: Optional[str] = None) -> List[Dict]:
        """Get usage statistics for a date range"""
        start, end = self._get_date_range(start_date, end_date)
        stats = []
        
        current = start
        while current <= end:
            data = self._load_data(current)
            stats.append({
                'date': data['date'],
                'usage': data['usage']
            })
            current += timedelta(days=1)
            
        return stats
        
    def get_performance_stats(self, start_date: Optional[str] = None,
                            end_date: Optional[str] = None) -> List[Dict]:
        """Get performance statistics for a date range"""
        start, end = self._get_date_range(start_date, end_date)
        stats = []
        
        current = start
        while current <= end:
            data = self._load_data(current)
            stats.append({
                'date': data['date'],
                'performance': data['performance']
            })
            current += timedelta(days=1)
            
        return stats
