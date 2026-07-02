from django.db import models
from django.contrib.auth.models import User # 1. Import Django's default User model

class Expense(models.Model):
    # 2. Link each expense to a specific user. 
    # If a user deletes their account, cascade delete their expenses automatically.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses', null=True, blank=True)
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def __str__(self):
        return f"{self.title} - ₹{self.amount}"


from django.db import models
from django.contrib.auth.models import User

class MonthlyBudget(models.Model):
    # Each user gets exactly one budget record
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='budget_settings')
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=15000.00) # Default budget set to 15,000
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Budget: ₹{self.amount}"
    
# step 2 gamified design

from django.db import models
from django.contrib.auth.models import User

# Keep your existing Expense model exactly as it is above this line!

class SavingsGoal(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='savings_goals')
    title = models.CharField(max_length=200) # e.g., "New Coding Gadget"
    target_amount = models.DecimalField(max_digits=10, decimal_places=2) # e.g., 5000.00
    current_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} - {self.user.username}"

class UserStreak(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='streak_profile')
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    last_tracked_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - Streak: {self.current_streak}"
    


from django.db import models
from django.contrib.auth.models import User
class SavingsTarget(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='savings_targets')
    # Change max_state=255 to max_length=255 here:
    name = models.CharField(max_length=255) 
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.amount} ({self.user.username})"